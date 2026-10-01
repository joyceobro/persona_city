// 게임 콘텐츠(정적 JSON)와 진행 상태(SaveData) 타입.
// 콘텐츠에는 "발견됨/완료됨" 같은 런타임 상태를 넣지 않는다. 상태는 SaveData 에만 있다.

export type PersonId = string;
export type LocationId = string;
export type RelationshipId = string;
export type QuestId = string;
export type InfoId = string;
export type TalkId = string;

/** 0 = 모르는 사람(카드만 있음), 1 = 아는 사람, 2 = 친구, 3 = 가까운 친구 */
export type FriendshipLevel = 0 | 1 | 2 | 3;

/** 동네 지표 (DESIGN_v2 §6): 활기 · 신뢰 · 생계. 0~100 */
export type StatId = "vitality" | "trust" | "livelihood";

// ---------------------------------------------------------------------------
// 조건 / 효과 — 정보 해금, 대화, 퀘스트 요구조건, 보상이 모두 이 두 타입을 공유한다.
// 조건 배열은 AND 로 평가한다. 빈 배열 또는 생략 = 항상 참.
// ---------------------------------------------------------------------------

export type Condition =
  | { type: "person_discovered"; personId: PersonId }
  | { type: "friendship"; personId: PersonId; level: FriendshipLevel }
  | { type: "location_discovered"; locationId: LocationId }
  | { type: "relationship_discovered"; relationshipId: RelationshipId }
  | { type: "info_discovered"; infoId: InfoId }
  | { type: "quest_unlocked"; questId: QuestId }
  | { type: "quest_completed"; questId: QuestId }
  | { type: "stat"; stat: StatId; min: number };

export type Effect =
  | { type: "discover_person"; personId: PersonId }
  | { type: "discover_location"; locationId: LocationId }
  | { type: "discover_relationship"; relationshipId: RelationshipId }
  | { type: "discover_info"; infoId: InfoId }
  | { type: "unlock_quest"; questId: QuestId }
  | { type: "friendship_xp"; personId: PersonId; amount: number }
  | { type: "stat"; stat: StatId; amount: number };

// ---------------------------------------------------------------------------
// Person
// ---------------------------------------------------------------------------

export type Rarity = "common" | "uncommon" | "rare";

export type PersonInfo = {
  id: InfoId;
  text: string;
  /** 생략 = 카드를 얻는 순간 공개 */
  unlock?: Condition[];
};

export type Talk = {
  id: TalkId;
  text: string;
  conditions?: Condition[];
  effects?: Effect[];
};

export type Person = {
  id: PersonId;
  name: string;
  age: number;
  occupation: string;
  /** 초상화 URL. 생략하면 src/assets/people/{id}.* 를 찾고, 없으면 이니셜로 대체 (ART.md 참고) */
  portrait?: string;

  traits: string[];
  interests: string[];
  skills: string[];

  goal: string;
  concern?: string;

  /** 이 사람을 만날 수 있는 장소 */
  locations: LocationId[];

  /**
   * 장소 탐험으로 이 사람을 발견하기 위한 조건.
   * 생략 = 장소를 탐험하면 발견 가능. 대화/퀘스트 효과로만 등장하는 인물은 빈 장소 목록 대신 조건으로 막는다.
   */
  discoverConditions?: Condition[];

  discoverableInfo: PersonInfo[];
  talks: Talk[];

  rarity?: Rarity;

  /** 원본 Persona Dataset 추적용. 게임 화면에는 노출하지 않는다. */
  source?: { dataset: string; uuid: string };
};

// ---------------------------------------------------------------------------
// Relationship (NPC ↔ NPC)
// ---------------------------------------------------------------------------

export type RelationshipType =
  | "friend"
  | "family"
  | "coworker"
  | "neighbor"
  | "mentor"
  | "student"
  | "business"
  | "rival"
  | "old_friend"
  | "hobby_friend";

export type Relationship = {
  id: RelationshipId;
  /** mentor/student 처럼 방향이 있는 관계는 from 이 주체 (from 이 to 의 멘토) */
  from: PersonId;
  to: PersonId;
  type: RelationshipType;
  /** 1(얕음) ~ 5(깊음) */
  strength: 1 | 2 | 3 | 4 | 5;
  description: string;
  /** 모두 만족하면 자동으로 발견된다. 생략 = 효과(대화/퀘스트)로만 발견 */
  discoverConditions?: Condition[];
  /** 발견 순간 적용되는 효과 */
  unlocks?: Effect[];
};

// ---------------------------------------------------------------------------
// Location
// ---------------------------------------------------------------------------

export type Location = {
  id: LocationId;
  name: string;
  description: string;
  /** 도시 지도 위 위치 (0~100 비율) */
  map: { x: number; y: number };
  /** 지도/초상화 강조색 */
  color: string;
  /** 지도에서 이 장소의 분위기를 정하는 동네 지표 (DESIGN_v2 §8-3) */
  mood?: StatId;
  /** 장소 일러스트 URL. 생략하면 src/assets/locations/{id}.* 를 찾고, 없으면 이미지 없이 표시 */
  image?: string;
};

// ---------------------------------------------------------------------------
// Quest
// ---------------------------------------------------------------------------

export type QuestCategory = "community" | "personal" | "mystery" | "local";

export type QuestRequirement = {
  condition: Condition;
  /** 퀘스트 UI 체크리스트에 보일 문구. 예: "기자와 친구 사이" */
  label: string;
};

export type QuestSolution = {
  id: string;
  title: string;
  description: string;
  requirements: QuestRequirement[];
  /** 이 해결 방법이 퀘스트 화면에 드러나는 조건. 생략 = 처음부터 보임, 미충족 시 "???" */
  revealConditions?: Condition[];
  rewards: Effect[];
};

/**
 * 문제의 기한. 기한 날까지 풀 수 있고, 그날이 지나면 실패한다.
 * - after_unlock: 공개된 날을 1일로 셀 때 days 일째까지 (공개일 + days - 1)
 * - on_day: 정해진 날까지
 */
export type QuestDeadline = { kind: "after_unlock"; days: number } | { kind: "on_day"; day: number };

export type QuestWorsening = {
  /** 기한 며칠 전에 악화되나. 0 = 마지막 날 */
  daysBefore: number;
  /** 악화된 뒤의 설명 */
  description: string;
  /** 악화되면 사라지는 해결 방법 */
  hideSolutionIds?: string[];
  effects?: Effect[];
};

export type Quest = {
  id: QuestId;
  title: string;
  description: string;
  category: QuestCategory;
  giverId?: PersonId;
  relatedPersonIds: PersonId[];
  solutions: QuestSolution[];
  /** 어떤 해결 방법으로 끝내든 공통으로 받는 보상 */
  rewards: Effect[];
  /**
   * 동네의 달력: 이날이 되면 (의뢰인을 이미 만났다면) 저절로 드러난다. 의뢰인을 나중에 만나면 그때 드러난다.
   * 대화로 더 일찍 알게 될 수도 있다. 생략 = 대화·보상으로만 열린다
   */
  appearsOnDay?: number;
  /** 생략 = 기한 없음 */
  deadline?: QuestDeadline;
  worsen?: QuestWorsening;
  /** 기한을 넘기면 적용 (지표 하락, 회복 문제 공개 등) */
  onFail?: Effect[];
  /** 놓친 문제에서 이어진 회복 문제 (화면 표시용) */
  recovery?: boolean;
};

// ---------------------------------------------------------------------------
// 시작 상태 / 저장
// ---------------------------------------------------------------------------

export type StartConfig = {
  locations: LocationId[];
  people: PersonId[];
  quests: QuestId[];
  relationships: RelationshipId[];
  /** 큰 목표 (DESIGN_v2 §7). 이 문제의 기한 날이 끝나면 게임이 끝난다 */
  mainQuest: QuestId;
};

export type Friendship = {
  personId: PersonId;
  level: FriendshipLevel;
  experience: number;
};

export type SaveData = {
  version: 2;
  discoveredLocations: LocationId[];
  discoveredPeople: PersonId[];
  friendships: Record<PersonId, Friendship>;
  discoveredRelationships: RelationshipId[];
  discoveredInfo: InfoId[];
  currentQuestIds: QuestId[];
  completedQuests: { questId: QuestId; solutionId: string }[];
  /** 한 번만 나오는 대화의 중복 방지 */
  seenTalkIds: TalkId[];
  /** 1일째부터 시작. 한 사람과는 하루에 한 번 대화할 수 있다 */
  day: number;
  talkedToday: PersonId[];
  /** 장소는 하루에 한 번 탐험할 수 있다 */
  exploredToday: LocationId[];
  /** 오늘 남은 행동력. 대화·탐험·해결이 1씩 쓴다 */
  actionPoints: number;
  stats: Record<StatId, number>;
  /** 문제가 공개된 날 (기한 계산용) */
  questUnlockedDay: Record<QuestId, number>;
  worsenedQuests: QuestId[];
  /** 기한을 넘겨 놓친 문제 */
  failedQuests: QuestId[];
  /** 그 사람과 마지막으로 함께한 날 (대화, 함께 해결). 소원해짐 계산용 */
  lastContactDay: Record<PersonId, number>;
  /** 마지막 날이 끝나 결말에 이르렀다 */
  ended: boolean;
  /** 발견 기록 (Journal "발견" 탭). 최근 LOG_LIMIT 개만 보관 */
  log: LogEntry[];
};

export type LogEntry = { day: number; event: LoggedEvent };

// ---------------------------------------------------------------------------
// 액션 / 이벤트 — 게임 로직은 (상태, 액션) → (새 상태, 이벤트 목록) 순수 함수다.
// 이벤트는 UI 가 토스트/연출을 띄우는 데 쓴다.
// ---------------------------------------------------------------------------

export type GameAction =
  | { type: "explore"; locationId: LocationId }
  | { type: "talk"; personId: PersonId }
  | { type: "solve_quest"; questId: QuestId; solutionId: string }
  | { type: "end_day" };

export type GameEvent =
  | { type: "person_discovered"; personId: PersonId }
  | { type: "location_discovered"; locationId: LocationId }
  | { type: "relationship_discovered"; relationshipId: RelationshipId }
  | { type: "info_discovered"; infoId: InfoId; personId: PersonId }
  | { type: "quest_unlocked"; questId: QuestId }
  | { type: "quest_completed"; questId: QuestId; solutionId: string }
  | { type: "friendship_level_up"; personId: PersonId; level: FriendshipLevel }
  | { type: "friendship_level_down"; personId: PersonId; level: FriendshipLevel }
  | { type: "drifting"; personId: PersonId }
  | { type: "stat_changed"; stat: StatId; amount: number }
  | { type: "quest_worsened"; questId: QuestId }
  | { type: "quest_failed"; questId: QuestId }
  | { type: "game_ended" }
  | { type: "talk"; personId: PersonId; text: string; isNew: boolean }
  | { type: "nothing_found"; locationId: LocationId }
  | { type: "day_started"; day: number };

/** 발견 기록에 남기는 이벤트. 대화/날짜 변경/빈 탐험/지표 변화/결말은 기록하지 않는다 */
export type LoggedEvent = Exclude<GameEvent, { type: "talk" | "nothing_found" | "day_started" | "stat_changed" | "game_ended" }>;

export type GameContent = {
  people: Person[];
  locations: Location[];
  relationships: Relationship[];
  quests: Quest[];
  start: StartConfig;
};
