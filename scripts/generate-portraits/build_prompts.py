"""초상화 프롬프트 생성: portrait-visuals.json + src/data/people.json -> generated/portrait-prompts.{md,json}

  npm run prompts:portraits

공통 스타일(ART.md)과 인물별 외형을 합쳐 모델에 상관없이 쓸 수 있는 프롬프트를 만든다.
아트 테스트 대상(artTest)이 문서 맨 앞에 온다.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
VISUALS = Path(__file__).with_name("portrait-visuals.json")
PEOPLE = ROOT / "src" / "data" / "people.json"
OUT_MD = ROOT / "generated" / "portrait-prompts.md"
OUT_JSON = ROOT / "generated" / "portrait-prompts.json"


def build_prompt(cfg: dict, v: dict) -> str:
    subject = f"{v['subject']}, {v['look']}, wearing {v['outfit']}, {v['prop']}, {v['expression']}"
    return f"{cfg['style']}. {cfg['composition']}. {subject}. {cfg['background']}."


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    cfg = json.loads(VISUALS.read_text(encoding="utf-8"))
    people = {p["id"]: p for p in json.loads(PEOPLE.read_text(encoding="utf-8"))}

    missing = sorted(set(people) - set(cfg["people"]))
    unknown = sorted(set(cfg["people"]) - set(people))
    if missing or unknown:
        print("외형 정보 누락:", missing, "/ 알 수 없는 ID:", unknown)
        return 1

    order = cfg["artTest"] + [pid for pid in people if pid not in cfg["artTest"]]
    items = [
        {
            "personId": pid,
            "name": people[pid]["name"],
            "occupation": people[pid]["occupation"],
            "artTest": pid in cfg["artTest"],
            "file": f"src/assets/people/{pid}.webp",
            "prompt": build_prompt(cfg, cfg["people"][pid]),
            "negative": cfg["negative"],
        }
        for pid in order
    ]

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")

    lines = [
        "# 초상화 프롬프트",
        "",
        "`npm run prompts:portraits` 로 생성됨. 원본: `scripts/generate-portraits/portrait-visuals.json`",
        "",
        "## 공통 네거티브 프롬프트",
        "",
        "네거티브 프롬프트를 지원하는 모델에만 쓴다. 지원하지 않으면 생략한다.",
        "",
        "```text",
        cfg["negative"],
        "```",
        "",
    ]
    section = None
    for it in items:
        header = "## 아트 테스트 (먼저 이 3명)" if it["artTest"] else "## 나머지 인물"
        if header != section:
            lines += [header, ""]
            section = header
        lines += [
            f"### {it['name']} · {it['occupation']} (`{it['personId']}`)",
            "",
            f"저장 위치: `{it['file']}`",
            "",
            "```text",
            it["prompt"],
            "```",
            "",
        ]
    OUT_MD.write_text("\n".join(lines), encoding="utf-8")

    print(f"{len(items)}명 프롬프트 → {OUT_MD.relative_to(ROOT)}, {OUT_JSON.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
