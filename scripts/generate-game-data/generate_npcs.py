"""NPC 초안 생성: 확정된 후보(npc-selection.json) -> generated/people.generated.json

기계적으로 채울 수 있는 필드(이름, 나이, 스킬, 관심사, 목표)는 채우고,
큐레이션이 필요한 필드(traits, concern, occupation 표기, 공개 정보 문장)는
원본 서술을 `_source` 에 붙여 사람이 검수/각색하도록 남긴다.
결과는 절대 src/data/ 를 덮어쓰지 않는다.

  npm run generate:npcs
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SELECTION = Path(__file__).with_name("npc-selection.json")
OUT = ROOT / "generated" / "people.generated.json"


def draft_person(sel: dict, cand: dict) -> dict:
    pid = sel["personId"]
    p = cand["personas"]
    info_sources = [
        ("professional", p["professional"]),
        ("family", p["family"]),
        ("hobby", cand["hobbies"]),
        ("culinary", p["culinary"]),
        ("arts", p["arts"]),
        ("travel", p["travel"]),
        ("goal", cand["careerGoals"]),
    ]
    return {
        "id": pid,
        "name": cand["name"],
        "age": cand["age"],
        "sex": cand["sex"],
        "occupation": cand["baseOccupation"],
        "summary": p["summary"],
        "traits": [],
        "interests": cand["hobbiesList"][:3],
        "skills": cand["skillsList"][:4],
        "goal": cand["careerGoals"],
        "concern": "",
        "locations": sel["locations"],
        "discoverableInfo": [
            {"id": f"{pid}_info_{i + 1}", "text": text, "source": kind}
            for i, (kind, text) in enumerate(info_sources)
        ],
        "_source": {
            "uuid": cand["source"]["uuid"],
            "candidateId": cand["candidateId"],
            "occupation": cand["occupation"],
            "jobStatus": cand["jobStatus"],
            "familyType": cand["familyType"],
            "maritalStatus": cand["maritalStatus"],
            "culturalBackground": cand["culturalBackground"],
            "skills": cand["skills"],
            "sports": p["sports"],
        },
    }


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    sel_cfg = json.loads(SELECTION.read_text(encoding="utf-8"))
    cand_path = ROOT / sel_cfg["candidatesFile"]
    if not cand_path.exists():
        print(f"{cand_path} 가 없습니다. 먼저 extract_candidates.py 를 실행하세요.")
        return 1
    candidates = {
        c["candidateId"]: c
        for b in json.loads(cand_path.read_text(encoding="utf-8"))["buckets"]
        for c in b["candidates"]
    }

    people, missing = [], []
    for sel in sel_cfg["selection"]:
        cand = candidates.get(sel["candidateId"])
        if cand is None:
            missing.append(sel["candidateId"])
            continue
        people.append(draft_person(sel, cand))
    if missing:
        print("후보 파일에 없는 candidateId:", ", ".join(missing))
        return 1

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(people, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{len(people)}명 초안 → {OUT.relative_to(ROOT)}")
    print("검수 후 src/data/people.json 에 반영하세요 (자동으로 덮어쓰지 않음).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
