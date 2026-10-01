"""Persona Dataset -> NPC 후보 추출.

장소(bucket)별 직업 화이트리스트에 맞는 페르소나를 연령대/성별/직업 다양성을
고려해 층화 샘플링하고, 사람이 검수할 후보 파일을 generated/ 에 쓴다.

  python scripts/import-personas/extract_candidates.py
  python scripts/import-personas/extract_candidates.py --seed 42

1단계: 가벼운 컬럼(uuid, age, sex, occupation, province)만 읽어 후보 선정
2단계: 선정된 uuid의 전체 레코드만 다시 읽음 (전체 데이터셋을 메모리에 올리지 않음)
"""

from __future__ import annotations

import argparse
import ast
import json
import random
import re
import sys
from collections import defaultdict
from pathlib import Path

import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.parquet as pq

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CONFIG = Path(__file__).with_name("candidate-config.json")
DEFAULT_OUT = ROOT / "generated"

LIGHT_COLUMNS = ["uuid", "age", "sex", "occupation", "province"]
SEEKER_RE = re.compile(r"^전직 (.+), 현재 구직중$")
NAME_RE = re.compile(r"^([가-힣]{2,4}) 씨")

PERSONA_FIELDS = {
    "summary": "persona",
    "professional": "professional_persona",
    "sports": "sports_persona",
    "arts": "arts_persona",
    "travel": "travel_persona",
    "culinary": "culinary_persona",
    "family": "family_persona",
}


def parse_occupation(raw: str | None) -> tuple[str, str]:
    """(기준 직업, 고용 상태)를 반환한다."""
    if not raw:
        return "", "unknown"
    m = SEEKER_RE.match(raw)
    if m:
        return m.group(1), "seeking"
    if raw == "무직":
        return raw, "none"
    return raw, "employed"


def age_band(age: int, bands: list[dict]) -> str:
    for b in bands:
        if b["min"] <= age <= b["max"]:
            return b["id"]
    return "unknown"


def parse_list(raw: str | None) -> list[str]:
    if not raw:
        return []
    try:
        value = ast.literal_eval(raw)
        return [str(v) for v in value] if isinstance(value, (list, tuple)) else [str(value)]
    except (ValueError, SyntaxError):
        return [raw]


def extract_name(row: dict) -> str | None:
    for field in ("persona", "professional_persona", "family_persona"):
        m = NAME_RE.match(row.get(field) or "")
        if m:
            return m.group(1)
    return None


def load_light_rows(files: list[Path], cfg: dict) -> list[dict]:
    provinces = set(cfg.get("provinces") or [])
    rows = []
    for path in files:
        table = pq.read_table(path, columns=LIGHT_COLUMNS)
        for r in table.to_pylist():
            if provinces and r["province"] not in provinces:
                continue
            base, status = parse_occupation(r["occupation"])
            if status == "seeking" and not cfg.get("includeJobSeekers", True):
                continue
            r["baseOccupation"] = base
            r["jobStatus"] = status
            r["ageBand"] = age_band(r["age"], cfg["ageBands"])
            r["sourceFile"] = path.name
            rows.append(r)
    return rows


def stratified_pick(pool: list[dict], count: int, bands: list[str], rng: random.Random) -> list[dict]:
    """연령대를 돌아가며 하나씩 뽑는다. 성별은 번갈아, 직업은 가능한 한 겹치지 않게."""
    by_band: dict[str, list[dict]] = defaultdict(list)
    for r in pool:
        by_band[r["ageBand"]].append(r)
    for rows in by_band.values():
        rng.shuffle(rows)

    band_order = [b for b in bands if by_band.get(b)]
    rng.shuffle(band_order)

    picked: list[dict] = []
    used_occ: set[str] = set()
    sexes = ["여자", "남자"]
    rng.shuffle(sexes)

    while len(picked) < count and any(by_band[b] for b in band_order):
        for band in band_order:
            if len(picked) >= count:
                break
            rows = by_band[band]
            if not rows:
                continue
            want_sex = sexes[len(picked) % 2]
            # 조건을 점점 완화하며 고른다: (새 직업 + 원하는 성별) → 새 직업 → 원하는 성별 → 아무나
            tests = [
                lambda r: r["baseOccupation"] not in used_occ and r["sex"] == want_sex,
                lambda r: r["baseOccupation"] not in used_occ,
                lambda r: r["sex"] == want_sex,
                lambda r: True,
            ]
            for test in tests:
                idx = next((i for i, r in enumerate(rows) if test(r)), None)
                if idx is not None:
                    row = rows.pop(idx)
                    picked.append(row)
                    used_occ.add(row["baseOccupation"])
                    break
    return picked


def load_full_rows(files: list[Path], uuids_by_file: dict[str, set[str]]) -> dict[str, dict]:
    full: dict[str, dict] = {}
    for path in files:
        wanted = uuids_by_file.get(path.name)
        if not wanted:
            continue
        table = pq.read_table(path)
        mask = pc.is_in(table["uuid"], value_set=pa.array(sorted(wanted)))
        for r in table.filter(mask).to_pylist():
            full[r["uuid"]] = r
    return full


def to_candidate(bucket_id: str, idx: int, light: dict, row: dict) -> dict:
    return {
        "candidateId": f"cand_{bucket_id}_{idx:02d}",
        "bucket": bucket_id,
        "source": {"uuid": row["uuid"], "file": light["sourceFile"]},
        "name": extract_name(row),
        "sex": row["sex"],
        "age": row["age"],
        "ageBand": light["ageBand"],
        "occupation": row["occupation"],
        "baseOccupation": light["baseOccupation"],
        "jobStatus": light["jobStatus"],
        "maritalStatus": row["marital_status"],
        "familyType": row["family_type"],
        "housingType": row["housing_type"],
        "educationLevel": row["education_level"],
        "bachelorsField": row["bachelors_field"],
        "province": row["province"],
        "district": row["district"],
        "personas": {k: row[v] for k, v in PERSONA_FIELDS.items()},
        "culturalBackground": row["cultural_background"],
        "skills": row["skills_and_expertise"],
        "skillsList": parse_list(row["skills_and_expertise_list"]),
        "hobbies": row["hobbies_and_interests"],
        "hobbiesList": parse_list(row["hobbies_and_interests_list"]),
        "careerGoals": row["career_goals_and_ambitions"],
    }


def write_review_sheet(path: Path, buckets: list[dict], result: dict[str, list[dict]]) -> None:
    lines = ["# NPC 후보 검수표", "", "각 장소에서 2~3명, 주민에서 3~4명을 골라 총 20명을 확정한다.", ""]
    for b in buckets:
        cands = result.get(b["id"], [])
        lines += [f"## {b['label']} (`{b['id']}`) — {len(cands)}명", ""]
        for c in cands:
            status = {"seeking": " · 구직중", "none": ""}.get(c["jobStatus"], "")
            lines.append(
                f"- [ ] **{c['name'] or '(이름없음)'}** ({c['sex'][0]}, {c['age']}) — "
                f"{c['occupation']}{status} · {c['district']} · `{c['candidateId']}`"
            )
            lines.append(f"  - {c['personas']['summary']}")
            lines.append(f"  - 목표: {c['careerGoals']}")
            lines.append(f"  - 취미: {', '.join(c['hobbiesList'][:3])}")
        lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    ap.add_argument("--seed", type=int, default=None)
    args = ap.parse_args()

    cfg = json.loads(args.config.read_text(encoding="utf-8"))
    seed = args.seed if args.seed is not None else cfg["seed"]
    rng = random.Random(seed)
    data_dir = ROOT / cfg["dataset"]["dir"]
    files = [data_dir / f for f in cfg["dataset"]["files"]]
    missing = [f for f in files if not f.exists()]
    if missing:
        print("데이터 파일을 찾을 수 없음:", *missing, sep="\n  ")
        return 1

    # 한 직업이 두 bucket에 들어가면 같은 사람이 중복 후보가 될 수 있다.
    seen_occ: dict[str, str] = {}
    for b in cfg["buckets"]:
        for occ in b["occupations"]:
            if occ in seen_occ:
                print(f"설정 오류: '{occ}' 가 {seen_occ[occ]} 와 {b['id']} 에 중복")
                return 1
            seen_occ[occ] = b["id"]

    print(f"[1/3] 경량 컬럼 로딩: {', '.join(f.name for f in files)}")
    rows = load_light_rows(files, cfg)
    print(f"      {len(rows):,} rows")

    band_ids = [b["id"] for b in cfg["ageBands"]]
    picked_by_bucket: dict[str, list[dict]] = {}
    print("[2/3] 층화 샘플링")
    for b in cfg["buckets"]:
        occs = set(b["occupations"])
        pool = [r for r in rows if r["baseOccupation"] in occs]
        picked = stratified_pick(pool, b["count"], band_ids, rng)
        picked_by_bucket[b["id"]] = picked
        print(f"      {b['label']:<16} pool {len(pool):>6,} → {len(picked)}명")

    uuids_by_file: dict[str, set[str]] = defaultdict(set)
    for picked in picked_by_bucket.values():
        for r in picked:
            uuids_by_file[r["sourceFile"]].add(r["uuid"])

    print("[3/3] 선정된 레코드 전체 필드 로딩")
    full = load_full_rows(files, uuids_by_file)

    result: dict[str, list[dict]] = {}
    for b in cfg["buckets"]:
        result[b["id"]] = [
            to_candidate(b["id"], i + 1, light, full[light["uuid"]])
            for i, light in enumerate(picked_by_bucket[b["id"]])
        ]

    args.out.mkdir(parents=True, exist_ok=True)
    json_path = args.out / "persona-candidates.json"
    md_path = args.out / "persona-candidates.md"
    payload = {
        "meta": {
            "source": "nvidia/Nemotron-Personas-Korea (CC BY 4.0, synthetic)",
            "files": cfg["dataset"]["files"],
            "seed": seed,
            "totalCandidates": sum(len(v) for v in result.values()),
        },
        "buckets": [
            {"id": b["id"], "label": b["label"], "candidates": result[b["id"]]}
            for b in cfg["buckets"]
        ],
    }
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    write_review_sheet(md_path, cfg["buckets"], result)

    print(f"\n완료: {payload['meta']['totalCandidates']}명")
    print(f"  {json_path.relative_to(ROOT)}")
    print(f"  {md_path.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
