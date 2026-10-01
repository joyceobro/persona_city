# 데이터 파이프라인: Persona Dataset → 게임 NPC

게임 NPC는 합성 페르소나 데이터셋을 원재료로 만든다. 원본을 그대로 노출하지 않고,
**자동 추출 → 사람 검수 → 게임 데이터** 순서를 거친다 (MVP.md §11, §12, §25).

```text
nvidia_korea_persona/…/data/*.parquet     원본 (100만 명, 9개 파일)
        │  npm run extract:candidates
        ▼
generated/persona-candidates.{json,md}    장소별 후보 58명 + 검수표
        │  사람이 20명 선택 → scripts/generate-game-data/npc-selection.json
        │  npm run generate:npcs
        ▼
generated/people.generated.json           게임 형식 초안 (원본 서술 포함)
        │  사람이 각색·검수 (성격, 고민, 공개 정보, 대화, 해온시 배경으로 지명 변경)
        ▼
src/data/people.json                      게임 데이터 (스크립트가 덮어쓰지 않음)
        │  npm run validate:data
        ▼
참조 무결성 + 도달 가능성 + 밸런스 검사
```

## 준비

```bash
python -m pip install -r scripts/import-personas/requirements.txt   # pyarrow
npm install
```

## 1. 후보 추출 — `npm run extract:candidates`

`scripts/import-personas/extract_candidates.py` + `candidate-config.json`

- 가벼운 컬럼(uuid, 나이, 성별, 직업, 지역)만 먼저 읽어 후보를 고른다. 그다음 뽑힌 사람의 전체 레코드만 다시 읽는다. 전체 데이터셋을 메모리에 올리지 않는다.
- 장소별 **직업 화이트리스트**로 매칭한다. 정규식은 오매칭이 생기기 쉽다 (예: "우편집배원"이 "편집"에 걸림).
- "전직 ○○, 현재 구직중"은 `jobStatus: "seeking"` 으로 구분한다.
- 연령대를 돌아가며 뽑고, 성별을 번갈아 맞추고, 같은 장소에서는 직업이 겹치지 않게 한다.
- 시드가 고정되어 있어 재현된다. 다른 후보를 보려면 `python scripts/import-personas/extract_candidates.py --seed 42`

규칙(장소별 직업, 인원 수, 연령대, 지역 필터)은 코드가 아니라 `candidate-config.json` 에서 바꾼다.

## 2. 선택

`generated/persona-candidates.md` 검수표를 보고 20명을 고른다.
결과는 `scripts/generate-game-data/npc-selection.json` 에 적는다 (`personId` ↔ `candidateId` ↔ 배치 장소).

## 3. 초안 생성 — `npm run generate:npcs`

`scripts/generate-game-data/generate_npcs.py`

- 기계적으로 채울 수 있는 필드(이름, 나이, 스킬, 관심사, 목표)는 채운다.
- 큐레이션이 필요한 필드(성격, 고민, 공개 정보 문장)는 원본 서술을 `_source` 에 붙여 남긴다.
- 결과는 `generated/` 에만 쓴다. **`src/data/` 는 절대 덮어쓰지 않는다.**

## 4. 검수·각색 → `src/data/people.json`

사람(또는 오프라인 LLM 보조)이 초안을 게임 캐릭터로 다듬는다.
- 실제 지명(광주, 수원 등)은 가상 도시 해온시의 장소로 바꾼다.
- 공개 정보는 5~7개로 쪼개고, 해금 조건을 단다. 카드를 얻는 것과 사람을 아는 것은 달라야 한다.
- 대화(`talks`)에 다른 사람·장소·관계로 이어지는 효과를 단다.
- 원본 추적용으로 `source.uuid` 를 남긴다. 게임 화면에는 노출하지 않는다.

## 5. 검증 — `npm run validate:data`

`scripts/validate-data/validate.ts`. 오류가 있으면 종료 코드 1을 반환한다.

## 데이터셋과 라이선스

- **NVIDIA Nemotron-Personas-Korea** v1.0 (2026-04-20), https://huggingface.co/datasets/nvidia/Nemotron-Personas-Korea
- **CC BY 4.0.** 상업·비상업 이용이 가능하다. **출처 표기가 필요하다.** 게임 화면 하단에 표기되어 있다.
- 모든 인물은 실제 인구 분포를 반영한 **완전한 합성 데이터**다. 실존 인물과 닮은 점은 우연이며, 개인정보로 취급하지 않는다.
- 원본 parquet(약 2GB)는 저장소에 포함하지 않는다.
