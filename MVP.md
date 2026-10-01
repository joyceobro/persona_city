# Persona City — Claude Code MVP 개발 지침

## 0. 프로젝트 목적

이 프로젝트는 **"사람을 만나 친구가 되고, 관계를 이용해 도시의 문제를 해결한다"**는 게임의 핵심 재미를 검증하기 위한 웹 기반 MVP다.

핵심 영감은 고전 Koei 삼국지에서 장수를 찾아 휘하에 모으고 관리하는 재미를 현대적인 **인간관계 수집 게임**으로 변환하는 것이다.

게임의 핵심은 전투가 아니다.

> 탐험 → 사람 발견 → 카드 획득 → 관계 형성 → 새로운 정보/장소 발견 → 사람 조합 → 문제 해결 → 새로운 탐험

Persona Dataset은 이미 프로젝트에 존재한다. Dataset 자체를 새로 다운로드하거나 웹에서 가져오지 않는다.

---

# 1. MVP의 성공 기준

MVP의 목적은 완성된 게임을 만드는 것이 아니다.

다음 경험이 실제로 재미있는지 검증한다.

1. 새로운 사람을 발견하면 그 사람의 카드를 보고 싶다.
2. 사람과 관계를 맺으면 새로운 정보가 열린다.
3. 한 사람을 통해 다른 사람이나 장소를 발견하는 것이 재미있다.
4. 문제를 보고 "누구를 찾아야 하지?"라고 생각하게 된다.
5. 가지고 있는 사람들의 관계를 조합해 문제를 해결하는 재미가 있다.
6. 문제를 해결하면 새로운 관계/장소/정보가 열린다.
7. 카드와 관계망을 다시 보고 싶어진다.

---

# 2. MVP 범위

## 반드시 구현

### 세계
- 작은 도시 1개
- 장소 6개
- 인물 20명
- 인물 카드 20장
- 인물 간 관계 약 40~60개
- 문제/퀘스트 8개
- 해결 방법이 여러 개인 문제 일부 포함

### 플레이
- 도시 지도에서 장소 선택
- 장소 탐험
- 인물 발견
- 인물 카드 획득
- 인물 상세 보기
- 친밀도 증가
- 대화/상호작용
- 관계 발견
- 관계망 보기
- 문제 확인
- 보유 인물/관계에 따른 해결 가능 여부 판단
- 문제 해결
- 해결 결과에 따라 새로운 사람/장소/정보 해금
- 게임 진행 상태 저장

## MVP에서 하지 않을 것

- 전투
- 장비
- 캐릭터 레벨업
- 가챠
- 결제
- 멀티플레이
- 서버 인증
- 복잡한 경제 시스템
- 대규모 3D 그래픽
- 실시간 LLM 대화
- 음성
- 모바일 앱
- 온라인 서비스 배포

---

# 3. 기술 스택

기본:

- React
- TypeScript
- Vite
- CSS
- 로컬 JSON 데이터
- localStorage

가능하면 추가 라이브러리는 최소화한다.

관계망 시각화가 필요하면 처음에는 직접 SVG로 구현한다.
필요성이 확인된 후에 그래프 라이브러리를 추가한다.

## 원칙

**MVP에서는 백엔드와 DB를 만들지 않는다.**

게임 데이터는 JSON으로 관리한다.

나중에 필요하면 Supabase 등의 DB로 이전할 수 있도록 데이터 구조를 명확하게 분리한다.

---

# 4. 프로젝트 구조

다음 구조를 기본으로 한다.

```text
src/
  components/
    CityMap/
    PersonCard/
    PersonDetail/
    RelationshipGraph/
    QuestPanel/
    Journal/
    DiscoveryToast/

  data/
    people.json
    locations.json
    relationships.json
    quests.json
    events.json

  types/
    game.ts

  game/
    gameState.ts
    discovery.ts
    relationships.ts
    quests.ts
    progression.ts

  pages/
    GamePage.tsx

  App.tsx
  main.tsx
  styles.css

scripts/
  import-personas/
  generate-game-data/

public/
  images/
    people/
    locations/
```

데이터와 게임 로직을 UI에서 분리한다.

---

# 5. 핵심 데이터 모델

## Person

```ts
type Person = {
  id: string;
  name: string;
  age: number;
  occupation: string;

  portrait?: string;

  traits: string[];
  interests: string[];

  goal: string;
  concern?: string;

  locations: string[];

  skills: string[];

  discoverableInfo: PersonInfo[];

  initialRelationshipIds: string[];

  rarity?: "common" | "uncommon" | "rare";
};
```

## PersonInfo

```ts
type PersonInfo = {
  id: string;
  text: string;
  unlockCondition:
    | { type: "discovery" }
    | { type: "friendship"; level: number }
    | { type: "relationship"; personId: string }
    | { type: "quest"; questId: string };
};
```

중요:

사람의 정보는 처음부터 전부 공개하지 않는다.

카드를 얻는 것과 그 사람을 이해하는 것은 다른 경험이어야 한다.

---

# 6. Relationship

```ts
type Relationship = {
  id: string;

  from: string;
  to: string;

  type:
    | "friend"
    | "family"
    | "coworker"
    | "neighbor"
    | "mentor"
    | "student"
    | "business"
    | "rival"
    | "old_friend";

  strength: number;

  discovered: boolean;

  description?: string;

  unlocks?: Unlock[];
};
```

관계는 단순 숫자가 아니다.

관계 자체가 게임 콘텐츠다.

예:

```text
김영수 ── 오래된 친구 ── 박미숙
```

이 관계를 발견하면:

- 박미숙의 카드 일부 공개
- 새로운 장소 공개
- 새로운 퀘스트 공개

등이 가능하다.

---

# 7. Friendship

플레이어와 NPC 사이의 관계다.

```ts
type Friendship = {
  personId: string;
  level: 0 | 1 | 2 | 3;
  experience: number;
  discoveredInfoIds: string[];
};
```

초기 단계:

```text
0 = 모르는 사람
1 = 아는 사람
2 = 친구
3 = 가까운 친구
```

MVP에서는 선물 시스템 등을 만들지 않는다.

친밀도는 다음과 같은 행동으로 증가시킨다.

- 대화
- 부탁 해결
- 관련 퀘스트 해결
- 적절한 사람 소개

---

# 8. Location

```ts
type Location = {
  id: string;
  name: string;
  description: string;

  discovered: boolean;

  personIds: string[];

  unlockCondition?: UnlockCondition;
};
```

MVP 장소 예시:

1. 중앙광장
2. 시장
3. 도서관
4. 카페
5. 주민센터
6. 오래된 극장

도시는 처음부터 모든 장소를 보여주지 않는다.

일부 장소는 사람을 통해 발견한다.

---

# 9. Quest

```ts
type Quest = {
  id: string;
  title: string;
  description: string;

  category:
    | "community"
    | "personal"
    | "mystery"
    | "local";

  requiredPeople?: string[];
  requiredRelationships?: string[];
  requiredInformation?: string[];

  solutions: QuestSolution[];

  rewards: Reward[];

  status: "locked" | "available" | "completed";
};
```

## QuestSolution

```ts
type QuestSolution = {
  id: string;
  title: string;

  requirements: Requirement[];

  description: string;

  rewards: Reward[];
};
```

하나의 문제에는 가능한 해결 방법을 여러 개 둔다.

예:

```text
오래된 극장을 살려라.

해결 방법 A
기자 + 지역 자료

해결 방법 B
건축가 + 오래된 기록

해결 방법 C
영화 동아리 + 주민 행사
```

모든 플레이어가 동일한 카드를 갖지 않아도 문제를 해결할 수 있어야 한다.

---

# 10. Persona Dataset 처리

Persona Dataset은 이미 로컬에 존재한다.

먼저 프로젝트에서 실제 파일 위치와 형식을 확인한다.

절대로 데이터셋의 형식을 추측하지 않는다.

Claude Code는 다음을 먼저 수행해야 한다.

```bash
find . -maxdepth 4 -type f | head -200
```

그리고 persona 관련 파일을 찾는다.

```bash
find . -type f | grep -i persona
```

CSV / JSON / JSONL / Parquet 등 실제 형식을 확인한다.

그 후 샘플 레코드 몇 개만 읽어서 스키마를 파악한다.

**전체 데이터셋을 처음부터 메모리에 로딩하지 않는다.**

---

# 11. Persona → Game Character 변환

Persona Dataset은 게임 NPC의 원재료로 사용한다.

원본 Persona를 게임 데이터에 그대로 노출하지 않는다.

변환 과정:

```text
Persona Dataset
      ↓
Sampling
      ↓
Filtering
      ↓
Game Character Transformation
      ↓
Relationship Generation
      ↓
Location Assignment
      ↓
Quest Generation
      ↓
Game JSON
```

초기 MVP에서는 20명의 NPC만 생성한다.

## 캐릭터 선정 조건

가능하면 다음의 다양성을 확보한다.

- 연령
- 직업
- 생활 방식
- 관심사
- 성격
- 사회적 관계

단, 인물의 개인정보처럼 보이는 요소를 실제 개인 정보로 취급하지 않는다.

Persona Dataset의 synthetic nature를 전제로 한다.

---

# 12. NPC 생성 스크립트

다음 스크립트를 만든다.

```text
scripts/generate-game-data/
```

목표:

```bash
npm run generate:npcs
```

실행하면:

```text
src/data/people.json
```

을 생성한다.

하지만 생성된 파일을 무조건 덮어쓰지 않는다.

처음에는:

```text
generated/
  people.generated.json
```

으로 만들고 사람이 검수한 뒤 게임 데이터로 이동할 수 있게 한다.

---

# 13. 관계 생성

20명 NPC 사이에 약 40~60개의 관계를 생성한다.

관계는 완전히 랜덤으로 만들지 않는다.

관계 생성 규칙:

### 같은 장소
같은 장소에서 일하거나 자주 방문하면:

- coworker
- neighbor
- business

등의 관계가 가능하다.

### 공통 관심사
- friend
- hobby_friend

등을 만들 수 있다.

### 연령/경력 차이
- mentor
- student

등이 가능하다.

### 충돌
특정 목표나 이해관계가 충돌하면:

- rival

등이 가능하다.

관계에는 가능한 경우 짧은 배경 설명을 만든다.

---

# 14. 게임 시작 상태

플레이어는 처음부터 모든 사람을 볼 수 없다.

초기 공개:

```text
장소 2개
NPC 3명
퀘스트 1개
```

정도.

첫 NPC를 통해 다른 NPC를 발견한다.

예:

```text
플레이어
  ↓
카페 직원 발견
  ↓
"시장에 자주 가는 사람이 있어요."
  ↓
시장 해금
  ↓
시장 NPC 발견
  ↓
새로운 관계 발견
```

이 구조를 MVP에서 반드시 구현한다.

---

# 15. 핵심 UI

## 1. City 화면

화면 중앙에 간단한 도시 지도.

각 장소는 카드 또는 버튼으로 표현한다.

```text
[도서관]       [카페]

       [중앙광장]

[시장]         [주민센터]

       [극장]
```

장소를 클릭하면 탐험한다.

---

## 2. Person Card

카드는 게임의 핵심 수집 UI다.

```text
┌─────────────────────┐
│                     │
│      PERSON         │
│                     │
│      초상화         │
│                     │
│      김영수         │
│      세탁소 주인    │
│                     │
│   ★ ★ ★            │
│                     │
│   발견 정보 3/7     │
└─────────────────────┘
```

카드 디자인은 화려한 TCG 스타일보다 **현대적인 수집 도감** 느낌을 우선한다.

---

# 16. 카드 발견 연출

새로운 NPC를 발견하면:

1. 카드가 화면에 나타난다.
2. 이름과 직업이 표시된다.
3. "새로운 사람을 알게 되었습니다." 표시.
4. 카드가 Journal에 추가된다.

새로운 관계 발견:

```text
김영수
   ↓
박미숙과 오래된 친구
```

관계가 카드 위에 표시되도록 한다.

---

# 17. Person Detail

카드를 클릭하면:

```text
이름
직업
초상화

성격
관심사

알고 있는 정보
██████░░ 4/7

친구 관계
- 박미숙
- 이정희

관련 장소
- 시장
- 세탁소

관련 문제
- 오래된 극장
```

정보를 모두 처음부터 표시하지 않는다.

---

# 18. Relationship Graph

별도의 탭을 만든다.

```text
          박미숙
            │
           친구
            │
김영수 ─────┼──── 기자
            │
           이웃
            │
          이정희
```

MVP에서는 SVG로 단순하게 만든다.

그래프가 너무 복잡해지면 자동 레이아웃을 추가한다.

---

# 19. Quest UI

퀘스트는 단순한 체크리스트가 아니다.

예:

```text
오래된 극장을 살려라

이 동네의 오래된 극장이 폐쇄될 예정이다.

알고 있는 사람:
✓ 기자
✓ 건축가
✗ 극장 소유자

가능한 접근:
✓ 지역신문에 알리기
✓ 건축 가치 조사
✗ 소유자 설득

[문제 해결]
```

해결 방법을 플레이어가 발견하게 한다.

---

# 20. Journal

Journal은 사실상 플레이어의 도시 백과사전이다.

탭:

```text
사람
장소
관계
문제
발견
```

사람 카드 수집과 관계 수집이 이곳에 누적된다.

---

# 21. 저장

MVP에서는 localStorage 사용.

저장해야 하는 것:

```ts
type SaveData = {
  discoveredLocations: string[];

  discoveredPeople: string[];

  friendships: Friendship[];

  discoveredRelationships: string[];

  completedQuests: string[];

  discoveredInfo: string[];

  currentQuestIds: string[];
};
```

새로고침해도 진행 상태가 유지되어야 한다.

---

# 22. 초기 콘텐츠

Claude Code가 임의로 거대한 콘텐츠를 만들지 않는다.

MVP는 다음 규모로 제한한다.

### NPC 20명

각 NPC:

- 이름
- 직업
- 성격 2~4개
- 관심사 2~3개
- 목표
- 고민
- 장소
- 관계
- 공개 정보 5~7개

### 장소 6개

### 관계 40~60개

### 퀘스트 8개

### 사건 10개 이하

---

# 23. NPC 이름과 세계관

세계관은 현대 한국의 가상 도시로 한다.

실제 특정 도시를 그대로 복제하지 않는다.

임시 도시명:

> 해온시

지역:

- 오래된 주택가
- 중앙시장
- 대학가
- 신도심

MVP는 이 중 오래된 주택가 중심으로 한다.

---

# 24. 게임의 톤

목표:

- 따뜻하지만 지나치게 감상적이지 않음
- 사람을 관찰하는 재미
- 작은 일상의 문제
- 약간의 미스터리
- 인간관계의 예상 밖 연결

피할 것:

- 과도한 판타지
- 전형적인 영웅 서사
- NPC를 능력치 숫자로만 표현
- 모든 문제가 거대한 위기인 구조
- 선악이 명확한 캐릭터

사람마다 나름의 이유와 목표가 있어야 한다.

---

# 25. LLM 사용 원칙

MVP에서는 LLM을 게임 실행 중 호출하지 않는다.

먼저 **오프라인 콘텐츠 생성**에 사용한다.

예:

```text
Persona
→ Character
→ Relationships
→ Events
→ Quest
```

생성 결과를 JSON으로 저장한다.

게임 실행 중에는 저장된 데이터만 사용한다.

이렇게 해야:

- 비용이 없다.
- 응답 지연이 없다.
- 재현성이 있다.
- 디버깅이 쉽다.

---

# 26. AI 생성 데이터 검증

AI가 생성한 콘텐츠는 자동 검증한다.

다음 문제가 있으면 오류로 표시한다.

- 존재하지 않는 personId
- 존재하지 않는 locationId
- 존재하지 않는 questId
- 자기 자신과의 관계
- 중복 관계
- 순환 참조 오류
- 필수 필드 누락
- 빈 문자열
- 동일한 NPC에 지나치게 비슷한 관계
- 퀘스트가 아무 방법으로도 해결되지 않는 경우

검증 스크립트:

```bash
npm run validate:data
```

출력 예:

```text
✓ 20 people
✓ 6 locations
✓ 53 relationships
✓ 8 quests

No broken references.
No unsolvable quests.
```

---

# 27. 개발 순서

Claude Code는 다음 순서로 작업한다.

## Phase 1 — 프로젝트 검사

- 현재 디렉터리 확인
- Persona Dataset 위치 확인
- 파일 형식 확인
- 기존 코드가 있으면 분석
- package.json 확인

먼저 코드를 수정하지 않는다.

분석 결과를 간단히 보고한다.

---

## Phase 2 — 데이터 모델

다음 파일 작성:

```text
src/types/game.ts
```

그리고 샘플 JSON 작성:

```text
src/data/people.json
src/data/locations.json
src/data/relationships.json
src/data/quests.json
```

---

## Phase 3 — 기본 게임 화면

구현:

```text
GamePage
 ├── CityMap
 ├── PersonCard
 ├── PersonDetail
 ├── QuestPanel
 └── Journal
```

---

## Phase 4 — 게임 상태

구현:

```text
gameState.ts
discovery.ts
relationships.ts
quests.ts
progression.ts
```

---

## Phase 5 — 저장

localStorage 연결.

---

## Phase 6 — Persona import

실제 Dataset을 분석한 뒤 20명 샘플 생성.

---

## Phase 7 — 관계망

NPC 간 관계를 연결하고 그래프로 표시.

---

## Phase 8 — 퀘스트

8개 퀘스트 구현.

최소 3개는 복수 해결 방법을 가진다.

---

## Phase 9 — UX 개선

다음 연출을 추가한다.

- 새 카드 획득
- 새로운 장소 발견
- 새로운 관계 발견
- 퀘스트 완료
- 정보 해금

---

# 28. 중요한 개발 원칙

### 원칙 1

**작동하는 게임을 먼저 만든다.**

디자인보다 게임 루프가 우선이다.

### 원칙 2

**데이터를 코드에 하드코딩하지 않는다.**

NPC/관계/퀘스트는 JSON으로 관리한다.

### 원칙 3

**ID 기반 참조를 사용한다.**

이름으로 관계를 연결하지 않는다.

잘못된 예:

```ts
target: "김영수"
```

좋은 예:

```ts
target: "person_001"
```

### 원칙 4

**게임 규칙과 콘텐츠를 분리한다.**

### 원칙 5

**새로운 라이브러리를 추가하기 전에 기존 기술로 해결 가능한지 확인한다.**

### 원칙 6

**MVP 범위를 벗어나는 기능을 발견하면 구현하지 말고 TODO로 기록한다.**

---

# 29. 첫 번째 플레이 테스트

완성 후 처음부터 플레이한다.

테스트 목표:

```text
처음 게임 실행
↓
첫 장소 탐험
↓
첫 NPC 발견
↓
카드 획득
↓
NPC 정보 확인
↓
다른 사람 발견
↓
관계 발견
↓
퀘스트 발견
↓
필요한 사람 탐색
↓
퀘스트 해결
↓
새로운 장소 또는 사람 해금
```

이 흐름이 **20~30분 정도 자연스럽게 이어지는지** 확인한다.

---

# 30. 절대 하지 말 것

MVP 단계에서 다음을 하지 않는다.

- 1000명 NPC 생성
- 100개 장소 생성
- MMORPG식 시스템
- 복잡한 경제
- 전투
- 가챠
- 광고
- 회원가입
- 서버 구축
- 실시간 AI NPC
- 완벽한 카드 일러스트
- 모바일 최적화
- 배포 자동화

핵심 루프가 재미있는지 확인하기 전까지 확장하지 않는다.

---

# 31. 최종 MVP 화면

최종적으로 다음 5개 화면이면 충분하다.

```text
┌──────────────────────────────────┐
│            PERSONA CITY          │
├──────────────────────────────────┤
│                                  │
│           CITY MAP               │
│                                  │
│    [도서관]       [카페]         │
│                                  │
│       [광장]──[시장]             │
│                                  │
│    [주민센터]      [극장]        │
│                                  │
├──────────────────────────────────┤
│ 사람 │ 관계 │ 문제 │ 기록        │
└──────────────────────────────────┘
```

그리고:

```text
[사람]
  ↓
Person Card

[관계]
  ↓
Relationship Graph

[문제]
  ↓
Quest Panel

[기록]
  ↓
Journal
```

---

# 32. 구현 완료 조건

다음 조건을 모두 만족하면 MVP 완료로 간주한다.

- [ ] 프로젝트가 정상 실행된다.
- [ ] 도시를 탐험할 수 있다.
- [ ] NPC를 발견할 수 있다.
- [ ] NPC 카드가 생성된다.
- [ ] 카드에 정보가 단계적으로 공개된다.
- [ ] NPC와 친밀도가 올라간다.
- [ ] NPC 간 관계를 발견할 수 있다.
- [ ] 관계망을 볼 수 있다.
- [ ] 퀘스트가 등장한다.
- [ ] 여러 해결 방법이 존재한다.
- [ ] 보유 관계/정보에 따라 해결 가능 여부가 달라진다.
- [ ] 해결하면 새로운 콘텐츠가 열린다.
- [ ] 새로고침해도 진행 상황이 유지된다.
- [ ] Persona Dataset에서 실제 NPC 데이터를 생성할 수 있다.
- [ ] 데이터 검증 스크립트가 동작한다.
- [ ] 20명 NPC / 6장소 / 8퀘스트가 실제 게임에서 연결되어 있다.

---

# 33. Claude Code 작업 방식

이 문서를 프로젝트 루트에:

```text
MVP.md
```

로 저장한다.

Claude Code를 실행한 뒤 먼저 이 파일을 읽게 한다.

첫 번째 요청:

> MVP.md를 읽고 현재 프로젝트와 Persona Dataset의 구조를 먼저 분석해줘. 코드는 아직 수정하지 말고, 발견한 파일 구조와 구현 계획을 요약해줘.

그 다음 단계별로 작업한다.

### 작업 1

> Phase 1 분석 결과를 바탕으로 데이터 모델을 구현해줘. 기존 파일을 함부로 삭제하지 말고 변경 이유를 설명해줘.

### 작업 2

> 이제 CityMap, PersonCard, PersonDetail의 최소 기능을 구현해줘.

### 작업 3

> 게임 상태와 localStorage 저장 기능을 구현해줘.

### 작업 4

> 실제 Persona Dataset의 구조를 확인하고 20개의 게임용 NPC 데이터를 생성하는 import/generation pipeline을 만들어줘.

### 작업 5

> NPC 관계망과 RelationshipGraph를 구현해줘.

### 작업 6

> 8개의 퀘스트와 복수 해결 방법을 구현해줘.

### 작업 7

> 전체 게임 루프를 처음부터 플레이할 수 있도록 연결하고 데이터 검증을 실행해줘.

---

# 34. 중요한 다음 단계

MVP가 재미있다고 판단된 후에만 다음을 고려한다.

```text
MVP
 ↓
관계망 확장
 ↓
NPC 기억
 ↓
동적 사건
 ↓
LLM 대화
 ↓
AI 일러스트
 ↓
도시 시뮬레이션
 ↓
장기 플레이
```

특히 **LLM 대화는 MVP 이후**로 미룬다.

이 게임의 핵심은 AI와 대화하는 것이 아니라,

> **"이 도시의 사람들을 알아가면서 내가 가진 인간관계가 점점 강력해지는 것"**

이기 때문이다.
