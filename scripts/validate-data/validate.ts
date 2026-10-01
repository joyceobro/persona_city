/**
 * 게임 데이터 검증 (MVP.md §26).  npm run validate:data
 *
 * 1. 스키마: 필수 필드, 빈 문자열, 허용 값, ID 중복
 * 2. 참조 무결성: 존재하지 않는 person/location/relationship/quest/info/talk 참조
 * 3. 관계: 자기 자신과의 관계, 같은 쌍의 중복 관계, 한 사람에게 같은 종류가 과하게 몰린 경우
 * 4. 도달 가능성: 실제 게임 엔진(reduce)으로, 행동력·기한을 끈 "샌드박스" 규칙에서 성실한 플레이어를
 *    시뮬레이션해 모든 사람/장소/관계/정보/퀘스트/해결 방법에 닿는지 확인한다.
 *    회복 문제는 원래 문제를 일부러 놓치는 두 번째 실행으로 확인한다.
 * 5. 실제 규칙 플레이 (DESIGN_v2 §9): 행동력·기한·소원해짐을 켠 채로 전략 플레이어를 돌려
 *    - 큰 목표의 해결 방법 중 적어도 2개가 마지막 날 안에 닿는지 (오류)
 *    - 한 판에 모든 문제를 풀 수 있는지 = 선택이 강제되지 않는지 (경고)
 * 6. 밸런스(경고): 하루에 너무 많은 사람이 등장하는지, 퀘스트가 너무 일찍 풀리는지
 *
 * 오류가 있으면 종료 코드 1.
 */

import type { Condition, Effect, FriendshipLevel, GameAction, GameContent, GameEvent, Quest, QuestSolution, SaveData, StatId } from "../../src/types/game";
import { content } from "../../src/data";
import { createInitialState, reduce } from "../../src/game/gameState";
import { areConditionsMet } from "../../src/game/conditions";
import { deadlineDay, solutionStatus, statChangesOf } from "../../src/game/quests";
import { DEFAULT_RULES, maxXpForLevel, STAT_IDS, type Rules } from "../../src/game/rules";
import { canTalkToday } from "../../src/game/talk";
import { canExploreToday } from "../../src/game/discovery";
import { lastDay } from "../../src/game/time";

const errors: string[] = [];
const warnings: string[] = [];
const err = (msg: string) => errors.push(msg);
const warn = (msg: string) => warnings.push(msg);

const { people, locations, relationships, quests, start } = content;

// ---------------------------------------------------------------------------
// ID 집합
// ---------------------------------------------------------------------------
const personIds = new Set(people.map((p) => p.id));
const locationIds = new Set(locations.map((l) => l.id));
const relationshipIds = new Set(relationships.map((r) => r.id));
const questIds = new Set(quests.map((q) => q.id));
const infoIds = new Set(people.flatMap((p) => p.discoverableInfo.map((i) => i.id)));
const allInfoCount = infoIds.size;

const RELATIONSHIP_TYPES = new Set(["friend", "family", "coworker", "neighbor", "mentor", "student", "business", "rival", "old_friend", "hobby_friend"]);
const RARITIES = new Set(["common", "uncommon", "rare"]);
const CATEGORIES = new Set(["community", "personal", "mystery", "local"]);

// ---------------------------------------------------------------------------
// 1. 스키마
// ---------------------------------------------------------------------------
function requireText(where: string, field: string, value: unknown) {
  if (typeof value !== "string") err(`${where}: ${field} 누락`);
  else if (value.trim() === "") err(`${where}: ${field} 빈 문자열`);
}
function requireArray(where: string, field: string, value: unknown, min = 1) {
  if (!Array.isArray(value)) err(`${where}: ${field} 누락`);
  else if (value.length < min) err(`${where}: ${field} 가 ${min}개 미만`);
}

const seen = new Map<string, string>();
function uniqueId(kind: string, id: string) {
  if (seen.has(id)) err(`ID 중복: ${id} (${seen.get(id)}, ${kind})`);
  seen.set(id, kind);
}

for (const p of people) {
  const w = p.id;
  uniqueId("person", p.id);
  requireText(w, "name", p.name);
  requireText(w, "occupation", p.occupation);
  requireText(w, "goal", p.goal);
  if (!Number.isInteger(p.age) || p.age < 19) err(`${w}: age 이상 (${p.age})`);
  requireArray(w, "traits", p.traits, 2);
  requireArray(w, "interests", p.interests, 2);
  requireArray(w, "skills", p.skills, 1);
  requireArray(w, "locations", p.locations, 1);
  requireArray(w, "talks", p.talks, 1);
  if (p.rarity && !RARITIES.has(p.rarity)) err(`${w}: rarity 값 이상 (${p.rarity})`);
  if (p.discoverableInfo.length < 5 || p.discoverableInfo.length > 7) warn(`${w}: 공개 정보 ${p.discoverableInfo.length}개 (권장 5~7)`);
  if (!p.discoverableInfo.some((i) => !i.unlock?.length)) err(`${w}: 카드 획득 시 공개되는 정보가 하나도 없음`);
  for (const i of p.discoverableInfo) {
    uniqueId("info", i.id);
    requireText(i.id, "text", i.text);
  }
  for (const t of p.talks) {
    uniqueId("talk", t.id);
    requireText(t.id, "text", t.text);
  }
  [...p.traits, ...p.interests, ...p.skills].forEach((s) => typeof s === "string" && !s.trim() && err(`${w}: 빈 태그`));
}
for (const l of locations) {
  uniqueId("location", l.id);
  requireText(l.id, "name", l.name);
  requireText(l.id, "description", l.description);
  if (!/^#[0-9a-f]{6}$/i.test(l.color ?? "")) err(`${l.id}: color 형식 이상`);
  if (!(l.map?.x >= 0 && l.map.x <= 100 && l.map.y >= 0 && l.map.y <= 100)) err(`${l.id}: map 좌표가 0~100 밖`);
}
for (const r of relationships) {
  uniqueId("relationship", r.id);
  requireText(r.id, "description", r.description);
  if (!RELATIONSHIP_TYPES.has(r.type)) err(`${r.id}: type 값 이상 (${r.type})`);
  if (!(Number.isInteger(r.strength) && r.strength >= 1 && r.strength <= 5)) err(`${r.id}: strength 는 1~5`);
}
for (const q of quests) {
  uniqueId("quest", q.id);
  requireText(q.id, "title", q.title);
  requireText(q.id, "description", q.description);
  if (!CATEGORIES.has(q.category)) err(`${q.id}: category 값 이상`);
  requireArray(q.id, "solutions", q.solutions, 1);
  for (const s of q.solutions) {
    uniqueId("solution", s.id);
    requireText(s.id, "title", s.title);
    requireArray(s.id, "requirements", s.requirements, 1);
    s.requirements.forEach((r, i) => requireText(`${s.id}.requirements[${i}]`, "label", r.label));
  }
}

// ---------------------------------------------------------------------------
// 2. 참조 무결성
// ---------------------------------------------------------------------------
function refPerson(where: string, id: string) { if (!personIds.has(id)) err(`${where}: 없는 personId ${id}`); }
function refLocation(where: string, id: string) { if (!locationIds.has(id)) err(`${where}: 없는 locationId ${id}`); }

function checkCondition(where: string, c: Condition) {
  switch (c.type) {
    case "person_discovered": return refPerson(where, c.personId);
    case "friendship":
      refPerson(where, c.personId);
      if (![0, 1, 2, 3].includes(c.level)) err(`${where}: friendship level ${c.level}`);
      return;
    case "location_discovered": return refLocation(where, c.locationId);
    case "relationship_discovered": if (!relationshipIds.has(c.relationshipId)) err(`${where}: 없는 relationshipId ${c.relationshipId}`); return;
    case "info_discovered": if (!infoIds.has(c.infoId)) err(`${where}: 없는 infoId ${c.infoId}`); return;
    case "quest_unlocked":
    case "quest_completed": if (!questIds.has(c.questId)) err(`${where}: 없는 questId ${c.questId}`); return;
    case "stat":
      if (!STAT_IDS.includes(c.stat)) err(`${where}: 없는 지표 ${c.stat}`);
      if (!(c.min > 0 && c.min <= 100)) err(`${where}: 지표 조건 min 은 1~100`);
      return;
    default: err(`${where}: 알 수 없는 조건 ${(c as { type: string }).type}`);
  }
}
function checkEffect(where: string, e: Effect) {
  switch (e.type) {
    case "discover_person": return refPerson(where, e.personId);
    case "discover_location": return refLocation(where, e.locationId);
    case "discover_relationship": if (!relationshipIds.has(e.relationshipId)) err(`${where}: 없는 relationshipId ${e.relationshipId}`); return;
    case "discover_info": if (!infoIds.has(e.infoId)) err(`${where}: 없는 infoId ${e.infoId}`); return;
    case "unlock_quest": if (!questIds.has(e.questId)) err(`${where}: 없는 questId ${e.questId}`); return;
    case "friendship_xp":
      refPerson(where, e.personId);
      if (!(e.amount > 0)) err(`${where}: friendship_xp amount 는 양수`);
      return;
    case "stat":
      if (!STAT_IDS.includes(e.stat)) err(`${where}: 없는 지표 ${e.stat}`);
      if (!Number.isInteger(e.amount) || e.amount === 0) err(`${where}: 지표 변화량은 0 이 아닌 정수`);
      return;
    default: err(`${where}: 알 수 없는 효과 ${(e as { type: string }).type}`);
  }
}
const conds = (where: string, list?: Condition[]) => list?.forEach((c) => checkCondition(where, c));
const effs = (where: string, list?: Effect[]) => list?.forEach((e) => checkEffect(where, e));

for (const p of people) {
  p.locations.forEach((l) => refLocation(p.id, l));
  conds(`${p.id}.discoverConditions`, p.discoverConditions);
  for (const i of p.discoverableInfo) {
    conds(i.id, i.unlock);
    if (i.unlock?.some((c) => c.type === "info_discovered" && c.infoId === i.id)) err(`${i.id}: 자기 자신을 해금 조건으로 참조`);
  }
  for (const t of p.talks) { conds(t.id, t.conditions); effs(t.id, t.effects); }
  if (p.discoverConditions?.some((c) => "personId" in c && c.personId === p.id)) err(`${p.id}: 자기 자신을 발견 조건으로 참조`);
}
for (const r of relationships) {
  refPerson(r.id, r.from);
  refPerson(r.id, r.to);
  conds(`${r.id}.discoverConditions`, r.discoverConditions);
  effs(`${r.id}.unlocks`, r.unlocks);
}
for (const q of quests) {
  if (q.giverId) refPerson(`${q.id}.giverId`, q.giverId);
  q.relatedPersonIds.forEach((id) => refPerson(`${q.id}.relatedPersonIds`, id));
  effs(`${q.id}.rewards`, q.rewards);
  effs(`${q.id}.onFail`, q.onFail);
  effs(`${q.id}.worsen.effects`, q.worsen?.effects);
  if (q.deadline) {
    const n = q.deadline.kind === "on_day" ? q.deadline.day : q.deadline.days;
    if (!(Number.isInteger(n) && n >= 1)) err(`${q.id}: deadline 은 1 이상의 정수`);
  }
  if (q.worsen) {
    if (!q.deadline) err(`${q.id}: 기한 없는 문제에 worsen`);
    requireText(`${q.id}.worsen`, "description", q.worsen.description);
    for (const id of q.worsen.hideSolutionIds ?? []) {
      if (!q.solutions.some((s) => s.id === id)) err(`${q.id}.worsen: 없는 해결 방법 ${id}`);
    }
    if ((q.worsen.hideSolutionIds?.length ?? 0) >= q.solutions.length) err(`${q.id}.worsen: 모든 해결 방법을 숨김`);
  }
  if (q.onFail && !q.deadline) err(`${q.id}: 기한 없는 문제에 onFail`);
  if (q.appearsOnDay !== undefined) {
    if (!(Number.isInteger(q.appearsOnDay) && q.appearsOnDay >= 1)) err(`${q.id}: appearsOnDay 는 1 이상의 정수`);
    if (q.deadline?.kind === "on_day" && q.appearsOnDay > q.deadline.day) err(`${q.id}: 기한보다 늦게 드러남`);
  }
  for (const s of q.solutions) {
    s.requirements.forEach((r) => checkCondition(s.id, r.condition));
    conds(`${s.id}.revealConditions`, s.revealConditions);
    effs(`${s.id}.rewards`, s.rewards);
  }
}
start.locations.forEach((id) => refLocation("start.locations", id));
start.people.forEach((id) => refPerson("start.people", id));
start.quests.forEach((id) => { if (!questIds.has(id)) err(`start.quests: 없는 questId ${id}`); });
start.relationships.forEach((id) => { if (!relationshipIds.has(id)) err(`start.relationships: 없는 relationshipId ${id}`); });
const mainQuest = quests.find((q) => q.id === start.mainQuest);
if (!mainQuest) err(`start.mainQuest: 없는 questId ${start.mainQuest}`);
else if (mainQuest.deadline?.kind !== "on_day") err(`${mainQuest.id}: 큰 목표에는 on_day 기한이 필요`);

// ---------------------------------------------------------------------------
// 3. 관계 구조
// ---------------------------------------------------------------------------
const pairs = new Map<string, string>();
const typeCountByPerson = new Map<string, Map<string, number>>();
for (const r of relationships) {
  if (r.from === r.to) err(`${r.id}: 자기 자신과의 관계`);
  const key = [r.from, r.to].sort().join("|");
  if (pairs.has(key)) err(`${r.id}: ${pairs.get(key)} 와 같은 두 사람의 중복 관계`);
  pairs.set(key, r.id);
  for (const pid of [r.from, r.to]) {
    const m = typeCountByPerson.get(pid) ?? new Map();
    m.set(r.type, (m.get(r.type) ?? 0) + 1);
    typeCountByPerson.set(pid, m);
  }
}
for (const [pid, m] of typeCountByPerson) {
  for (const [type, n] of m) if (n >= 4) warn(`${pid}: '${type}' 관계가 ${n}개 — 관계가 단조로움`);
}
for (const p of people) {
  const degree = relationships.filter((r) => r.from === p.id || r.to === p.id).length;
  if (degree === 0) err(`${p.id}: 관계가 하나도 없음`);
  else if (degree === 1) warn(`${p.id}(${p.name}): 관계가 1개뿐`);
}

// ---------------------------------------------------------------------------
// 4. 도달 가능성 — 샌드박스 규칙(행동력 무제한, 소원해짐 없음)으로 성실한 플레이어 시뮬레이션
//    매일: 아는 장소를 모두 탐험 → 만난 모든 사람과 대화 → 퀘스트 해결 → 하루 마치기
//    모든 해결 방법이 열리는지 보려고, 퀘스트는 "모든 방법이 가능해졌을 때" 또는
//    "진전이 한동안 멈췄을 때"(다른 콘텐츠가 이 퀘스트 완료를 기다리는 경우) 해결한다.
// ---------------------------------------------------------------------------
const MAX_DAYS = 60;
const STALL_DAYS = 6; // 잡담 경험치만으로 다음 친밀도 단계까지 걸리는 최대 일수
const SANDBOX: Rules = { actionPointsPerDay: 999, driftAfterDays: 999, driftXpPerDay: 0, deadlines: false };

/** 이 해결 방법에 걸린 지표 조건 */
function focusStatsOf(solutionId?: string): StatId[] {
  const sol = mainQuest?.solutions.find((x) => x.id === solutionId);
  return (sol?.requirements ?? []).flatMap((r) => (r.condition.type === "stat" ? [r.condition.stat] : []));
}

/** 풀 수 있는 방법 중: 노리는 지표를 가장 많이 올리는 것 → 지표 합이 큰 것 */
function pickSolution(q: Quest, ready: QuestSolution[], focusStats: StatId[]): QuestSolution | undefined {
  const score = (sol: QuestSolution) => {
    const d = statChangesOf(q, sol);
    const focused = focusStats.reduce((n, id) => n + (d[id] ?? 0), 0);
    const total = Object.values(d).reduce((n, v) => n + (v ?? 0), 0);
    return focused * 1000 + total;
  };
  return [...ready].sort((a, b) => score(b) - score(a))[0];
}

type SandboxPick = { focus?: string; nth?: number };

type SandboxResult = {
  s: SaveData;
  actions: number;
  personDay: Map<string, number>;
  peoplePerDay: Map<number, number>;
  solutionReadyDay: Map<string, number>;
};

/**
 * @param neglect 이 문제들은 풀지 않고 기한을 넘긴다 (회복 문제 확인용)
 * @param target 다 모으면 멈추는 기준
 * @param pick 해결 방법 고르기. 선택이 이후 콘텐츠(보상)를 바꾸므로 여러 방식으로 돌려 합친다.
 *   - { focus }: 큰 목표를 이 방법으로만 풀고, 다른 문제는 그 방법에 필요한 지표를 가장 많이 올리는 방법으로
 *   - { nth }: 모든 문제를 n 번째 방법으로 (없으면 마지막)
 */
function runSandbox(c: GameContent, rules: Rules, neglect: Set<string>, target: Quest[], pick: SandboxPick = {}): SandboxResult {
  const focus = pick.focus;
  const focusStats = focusStatsOf(focus);
  let s: SaveData = createInitialState(c, rules);
  const personDay = new Map<string, number>();
  const peoplePerDay = new Map<number, number>();
  const solutionReadyDay = new Map<string, number>();
  let actions = 0;

  const act = (a: GameAction) => {
    actions++;
    const r = reduce(c, s, a, rules);
    s = r.state;
    for (const e of r.events) {
      if (e.type === "person_discovered") {
        personDay.set(e.personId, s.day);
        peoplePerDay.set(s.day, (peoplePerDay.get(s.day) ?? 0) + 1);
      }
    }
  };
  const progressKey = () =>
    [s.discoveredPeople, s.discoveredLocations, s.discoveredRelationships, s.discoveredInfo, s.completedQuests, s.currentQuestIds, s.failedQuests]
      .map((x) => x.length)
      .join("/") + "/" + Object.values(s.friendships).reduce((n, f) => n + f.level, 0);
  const complete = () =>
    s.discoveredPeople.length === people.length &&
    s.discoveredLocations.length === locations.length &&
    s.discoveredRelationships.length === relationships.length &&
    s.discoveredInfo.length === allInfoCount &&
    target.every((q) => s.completedQuests.some((d) => d.questId === q.id));

  let stalled = 0;
  while (s.day <= MAX_DAYS && !complete()) {
    const before = progressKey();
    for (const loc of [...s.discoveredLocations]) act({ type: "explore", locationId: loc });
    for (const pid of [...s.discoveredPeople]) if (canTalkToday(s, pid)) act({ type: "talk", personId: pid });

    for (const q of c.quests) {
      if (!s.currentQuestIds.includes(q.id) || neglect.has(q.id)) continue;
      for (const sol of q.solutions) {
        if (!solutionReadyDay.has(sol.id) && solutionStatus(s, sol, q) === "ready") solutionReadyDay.set(sol.id, s.day);
      }
      const allowed = q.solutions.filter((sol) => !(q.id === start.mainQuest && focus && sol.id !== focus));
      const allSeen = allowed.every((sol) => solutionReadyDay.has(sol.id));
      const readyNow = allowed.filter((sol) => solutionStatus(s, sol, q) === "ready");
      const ready =
        pick.nth === undefined
          ? pickSolution(q, readyNow, focusStats)
          : (readyNow.find((sol) => sol === allowed[Math.min(pick.nth!, allowed.length - 1)]) ?? (allSeen ? undefined : readyNow[0]));
      if (ready && (allSeen || stalled >= STALL_DAYS)) act({ type: "solve_quest", questId: q.id, solutionId: ready.id });
    }

    stalled = progressKey() === before ? stalled + 1 : 0;
    if (stalled > STALL_DAYS * 2) break;
    if (!complete()) act({ type: "end_day" });
  }
  return { s, actions, personDay, peoplePerDay, solutionReadyDay };
}

const regularQuests = quests.filter((q) => !q.recovery);
const recoveryQuests = quests.filter((q) => q.recovery);
const maxSolutions = Math.max(...quests.map((q) => q.solutions.length));
const sandboxRuns = [
  ...(mainQuest?.solutions ?? []).map((sol) => runSandbox(content, SANDBOX, new Set(), regularQuests, { focus: sol.id })),
  ...Array.from({ length: maxSolutions }, (_, nth) => runSandbox(content, SANDBOX, new Set(), regularQuests, { nth })),
];
const main = sandboxRuns[0];

// 회복 문제: 회복 문제로 이어지는 문제를 일부러 놓친다. 큰 목표의 기한이 게임을 끝내지 않도록 늦춘다.
const recoverySources = new Set(
  quests.filter((q) => q.onFail?.some((e) => e.type === "unlock_quest")).map((q) => q.id),
);
const neglectContent: GameContent = {
  ...content,
  quests: quests.map((q) => (q.id === start.mainQuest ? { ...q, deadline: { kind: "on_day", day: 9999 } } : q)),
};
const neglect = runSandbox(neglectContent, { ...SANDBOX, deadlines: true }, recoverySources, recoveryQuests);

const allRuns = [...sandboxRuns, neglect];
const reached = (pick: (s: SaveData) => string[]) => new Set(allRuns.flatMap((r) => pick(r.s)));
const reachedPeople = reached((s) => s.discoveredPeople);
const reachedLocations = reached((s) => s.discoveredLocations);
const reachedRelationships = reached((s) => s.discoveredRelationships);
const reachedInfo = reached((s) => s.discoveredInfo);
const solvedQuests = reached((s) => s.completedQuests.map((c) => c.questId));
const seenSolutions = new Set(allRuns.flatMap((r) => [...r.solutionReadyDay.keys()]));

people.filter((x) => !reachedPeople.has(x.id)).forEach((x) => err(`도달 불가: 사람 ${x.id}`));
locations.filter((x) => !reachedLocations.has(x.id)).forEach((x) => err(`도달 불가: 장소 ${x.id}`));
relationships.filter((x) => !reachedRelationships.has(x.id)).forEach((x) => err(`도달 불가: 관계 ${x.id}`));
[...infoIds].filter((id) => !reachedInfo.has(id)).forEach((id) => err(`도달 불가: 정보 ${id}`));
for (const q of quests) {
  if (!solvedQuests.has(q.id)) err(`해결 불가: 퀘스트 ${q.id} (${q.title})`);
  for (const sol of q.solutions) if (!seenSolutions.has(sol.id)) err(`도달 불가: 해결 방법 ${sol.id} (${sol.title})`);
}
for (const q of recoveryQuests) {
  if (!quests.some((src) => src.onFail?.some((e) => e.type === "unlock_quest" && e.questId === q.id))) {
    err(`${q.id}: 회복 문제인데 어떤 문제의 onFail 에서도 열리지 않음`);
  }
}

// ---------------------------------------------------------------------------
// 5. 실제 규칙 플레이 — 전략 플레이어
//    매 행동마다 우선순위: 풀 수 있는 문제 해결 → 문제에 필요한 사람과 대화 → 소원해질 사람 챙기기
//    → 새 사람이 있는 장소 탐험 → 새 이야기가 남은 사람과 대화 → 잡담.
//    focus 가 있으면 큰 목표를 그 해결 방법으로만 풀고, 그 방법에 필요한 사람을 가장 먼저 챙긴다.
// ---------------------------------------------------------------------------
const LAST_DAY = lastDay(content);
/** 수치 실험용: AP=3 npm run validate:data 처럼 행동력·소원해짐 일수를 바꿔 볼 수 있다 */
const PLAY_RULES: Rules = {
  ...DEFAULT_RULES,
  ...(process.env.AP ? { actionPointsPerDay: Number(process.env.AP) } : {}),
  ...(process.env.DRIFT ? { driftAfterDays: Number(process.env.DRIFT) } : {}),
};

type PlayResult = {
  focus: string | null;
  mainSolution?: string;
  mainDay?: number;
  completed: string[];
  failed: string[];
  stats: SaveData["stats"];
  actions: number;
  events: GameEvent[];
};

function hasNewTalk(st: SaveData, personId: string): boolean {
  const p = people.find((x) => x.id === personId)!;
  return p.talks.some((t) => !st.seenTalkIds.includes(t.id) && areConditionsMet(st, t.conditions));
}
function talkHelps(st: SaveData, personId: string): boolean {
  return hasNewTalk(st, personId) || (st.friendships[personId]?.experience ?? 0) < maxXpForLevel(1);
}
type Need = { kind: "talk"; personId: string; level: FriendshipLevel } | { kind: "explore"; locationId: string };

/**
 * 조건을 채우려면 무엇을 해야 하나: 누구와 어느 단계까지 가까워지기, 또는 어디를 탐험하기.
 * 정보·관계·인물·장소 조건은 그 해금 조건이나, 그것을 알려 주는 대화의 주인까지 거슬러 올라간다.
 */
function needsOf(st: SaveData, c: Condition, depth = 0): Need[] {
  if (depth > 4 || isMet(st, c)) return [];
  const deeper = (list: Condition[] | undefined) => (list ?? []).flatMap((x) => needsOf(st, x, depth + 1));
  const viaTalks = (pred: (e: Effect) => boolean): Need[] =>
    people.flatMap((p) =>
      p.talks
        .filter((t) => !st.seenTalkIds.includes(t.id) && t.effects?.some(pred))
        .flatMap((t) => [
          ...(st.discoveredPeople.includes(p.id) ? [{ kind: "talk" as const, personId: p.id, level: 1 as FriendshipLevel }] : []),
          ...deeper([{ type: "person_discovered", personId: p.id }, ...(t.conditions ?? [])]),
        ]),
    );
  switch (c.type) {
    case "friendship":
      return st.discoveredPeople.includes(c.personId)
        ? [{ kind: "talk", personId: c.personId, level: c.level }]
        : needsOf(st, { type: "person_discovered", personId: c.personId }, depth + 1);
    case "person_discovered": {
      const p = people.find((x) => x.id === c.personId)!;
      const spots: Need[] = areConditionsMet(st, p.discoverConditions)
        ? p.locations.flatMap((loc): Need[] =>
            st.discoveredLocations.includes(loc)
              ? [{ kind: "explore", locationId: loc }]
              : needsOf(st, { type: "location_discovered", locationId: loc }, depth + 1),
          )
        : deeper(p.discoverConditions);
      return [...spots, ...viaTalks((e) => e.type === "discover_person" && e.personId === c.personId)];
    }
    case "location_discovered":
      return viaTalks((e) => e.type === "discover_location" && e.locationId === c.locationId);
    case "info_discovered": {
      const owner = people.find((p) => p.discoverableInfo.some((i) => i.id === c.infoId))!;
      const info = owner.discoverableInfo.find((i) => i.id === c.infoId)!;
      return [
        ...deeper([{ type: "person_discovered", personId: owner.id }, ...(info.unlock ?? [])]),
        ...viaTalks((e) => e.type === "discover_info" && e.infoId === c.infoId),
      ];
    }
    case "relationship_discovered": {
      const rel = relationships.find((r) => r.id === c.relationshipId)!;
      return [
        ...deeper(rel.discoverConditions && [
          { type: "person_discovered", personId: rel.from },
          { type: "person_discovered", personId: rel.to },
          ...rel.discoverConditions,
        ]),
        ...viaTalks((e) => e.type === "discover_relationship" && e.relationshipId === c.relationshipId),
      ];
    }
    default:
      return [];
  }
}
const isMet = (st: SaveData, c: Condition) => areConditionsMet(st, [c]);

function chooseAction(st: SaveData, focus: string | null): GameAction | null {
  const current = quests.filter((q) => st.currentQuestIds.includes(q.id));
  const allowed = (q: Quest, solId: string) => !(q.id === start.mainQuest && focus && solId !== focus);

  // 1. 해결. 노리는 지표에 더 좋은 방법이 아직 막혀 있고 기한이 넉넉하면 기다린다.
  const focusStats = focusStatsOf(focus ?? undefined);
  for (const q of current) {
    const ready = q.solutions.filter((sol) => allowed(q, sol.id) && solutionStatus(st, sol, q) === "ready");
    const best = pickSolution(q, ready, focusStats);
    if (!best) continue;
    const open = q.solutions.filter((sol) => allowed(q, sol.id) && solutionStatus(st, sol, q) === "blocked");
    const better = pickSolution(q, [best, ...open], focusStats);
    const left = (deadlineDay(st, q) ?? LAST_DAY) - st.day;
    if (better !== best && left >= 2) continue;
    return { type: "solve_quest", questId: q.id, solutionId: best.id };
  }

  // 2~3. 문제에 필요한 일 (부족한 것 먼저, 그다음 소원해질 사람 챙기기)
  const need = new Map<string, { prio: number; action: GameAction }>();
  const keep = new Map<string, number>();
  const want = (key: string, prio: number, action: GameAction) => {
    if (prio < (need.get(key)?.prio ?? Infinity)) need.set(key, { prio, action });
  };
  for (const q of current) {
    const urgency = (deadlineDay(st, q) ?? LAST_DAY) - st.day;
    for (const sol of q.solutions) {
      if (!allowed(q, sol.id)) continue;
      const status = solutionStatus(st, sol, q);
      if (status === "hidden" || status === "lost") continue;
      const prio = urgency + (focus === sol.id ? -100 : 0);
      for (const r of sol.requirements) {
        if (r.condition.type === "friendship" && isMet(st, r.condition)) {
          keep.set(r.condition.personId, Math.min(keep.get(r.condition.personId) ?? Infinity, prio));
          continue;
        }
        for (const n of needsOf(st, r.condition)) {
          if (n.kind === "explore") {
            if (canExploreToday(st, n.locationId)) want(`e:${n.locationId}`, prio, { type: "explore", locationId: n.locationId });
          } else if ((st.friendships[n.personId]?.level ?? -1) < n.level || hasNewTalk(st, n.personId)) {
            if (canTalkToday(st, n.personId) && talkHelps(st, n.personId)) want(`t:${n.personId}`, prio, { type: "talk", personId: n.personId });
          }
        }
      }
    }
  }
  const best = [...need.values()].sort((a, b) => a.prio - b.prio)[0];
  if (best) return best.action;
  for (const [pid] of [...keep].sort((a, b) => a[1] - b[1])) {
    const gap = st.day - (st.lastContactDay[pid] ?? st.day);
    if (canTalkToday(st, pid) && gap >= PLAY_RULES.driftAfterDays - 1) return { type: "talk", personId: pid };
  }

  // 4. 새 사람이 있는 장소
  for (const loc of st.discoveredLocations) {
    const someone = people.some(
      (p) => p.locations.includes(loc) && !st.discoveredPeople.includes(p.id) && areConditionsMet(st, p.discoverConditions),
    );
    if (someone && canExploreToday(st, loc)) return { type: "explore", locationId: loc };
  }

  // 5~6. 새 이야기 → 잡담
  for (const pid of st.discoveredPeople) if (canTalkToday(st, pid) && hasNewTalk(st, pid)) return { type: "talk", personId: pid };
  for (const pid of st.discoveredPeople) if (canTalkToday(st, pid) && talkHelps(st, pid)) return { type: "talk", personId: pid };
  return null;
}

function play(focus: string | null): PlayResult {
  let st = createInitialState(content, PLAY_RULES);
  let actions = 0;
  const events: GameEvent[] = [];
  let mainDay: number | undefined;
  for (let guard = 0; guard < 2000 && !st.ended; guard++) {
    const a: GameAction = (st.actionPoints > 0 && chooseAction(st, focus)) || { type: "end_day" };
    if (a.type !== "end_day") actions++;
    const r = reduce(content, st, a, PLAY_RULES);
    st = r.state;
    events.push(...r.events);
    if (r.events.some((e) => e.type === "quest_completed" && e.questId === start.mainQuest)) mainDay = st.day;
  }
  if (process.env.TRACE === (focus ?? "free")) printTrace(focus, st, events);
  return {
    focus,
    mainSolution: st.completedQuests.find((c) => c.questId === start.mainQuest)?.solutionId,
    mainDay,
    completed: st.completedQuests.map((c) => c.questId),
    failed: st.failedQuests,
    stats: st.stats,
    actions,
    events,
  };
}

/** 수치 조정용: TRACE=free 또는 TRACE=quest_002_a 로 그 전략의 하루하루를 찍는다 */
function printTrace(focus: string | null, st: SaveData, events: GameEvent[]) {
  console.log(`[TRACE ${focus ?? "free"}] 끝: 진행 중 ${st.currentQuestIds.join(",")} / 해결 ${st.completedQuests.map((c) => c.questId).join(",")}`);
  for (const sol of mainQuest?.solutions ?? []) {
    console.log("  ", sol.title, sol.requirements.map((r) => `${isMet(st, r.condition) ? "✓" : "✗"}${r.label}`).join(" | "));
  }
  const short = (e: GameEvent) => JSON.stringify(Object.values(e).slice(1)).replace(/person_|quest_|"/g, "");
  const byDay = new Map<number, string[]>();
  let day = 1;
  for (const e of events) {
    if (e.type === "day_started") day = e.day;
    const label =
      e.type === "talk" ? `talk:${e.personId.slice(-3)}${e.isNew ? "*" : ""}` :
      e.type === "nothing_found" ? "none" :
      e.type === "day_started" || e.type === "info_discovered" || e.type === "relationship_discovered" ? "" :
      `${e.type.replace("friendship_", "")}:${short(e)}`;
    if (label) byDay.set(day, [...(byDay.get(day) ?? []), label]);
  }
  for (const [d, l] of byDay) console.log(`   ${d}: ${l.join(" ")}`);
}

const plays = mainQuest ? [null, ...mainQuest.solutions.map((x) => x.id)].map(play) : [];
const reachedMain = new Set(plays.map((p) => p.mainSolution).filter((x): x is string => !!x));
if (mainQuest && reachedMain.size < 2) {
  err(`큰 목표: 전략 플레이어가 ${LAST_DAY}일 안에 닿은 해결 방법이 ${reachedMain.size}개 (2개 이상 필요)`);
}
for (const p of plays) {
  if (regularQuests.every((q) => p.completed.includes(q.id))) {
    warn(`전략 ${p.focus ?? "자유"}: 한 판에 모든 문제를 해결함 — 선택이 강제되지 않음`);
  }
}

// ---------------------------------------------------------------------------
// 6. 밸런스 경고 (샌드박스 실행 기준)
// ---------------------------------------------------------------------------
// 탐험은 장소당 하루 1회라 하루 최대 등장 인원은 장소 수로 제한된다. 한 장소에서 몰리는 경우만 경고한다.
const perDayMax = Math.max(0, ...main.peoplePerDay.values());
if (perDayMax > locations.length) warn(`하루에 새 인물 ${perDayMax}명 등장 — 장소 수(${locations.length})보다 많음`);
for (const q of regularQuests) {
  const days = q.solutions.map((sol) => main.solutionReadyDay.get(sol.id)).filter((d): d is number => d !== undefined);
  if (!days.length) continue;
  const earliest = Math.min(...days);
  const lastPerson = Math.max(...q.relatedPersonIds.map((id) => main.personDay.get(id) ?? 1));
  // 해결 방법이 여럿이면 한쪽으로 먼저 풀리는 건 자연스럽다. 2일 넘게 앞서는 경우만 경고한다.
  if (earliest + 2 < lastPerson) {
    warn(`${q.id}(${q.title}): ${earliest}일째에 풀 수 있는데, 관련 인물은 ${lastPerson}일째에야 모두 등장`);
  }
}

// ---------------------------------------------------------------------------
// 출력
// ---------------------------------------------------------------------------
const ok = (label: string) => console.log(`✓ ${label}`);
ok(`${people.length} people`);
ok(`${locations.length} locations`);
ok(`${relationships.length} relationships`);
ok(`${quests.length} quests (${quests.reduce((n, q) => n + q.solutions.length, 0)} solutions, 회복 문제 ${recoveryQuests.length})`);
ok(`${allInfoCount} info`);
console.log("");
console.log(`샌드박스: ${main.s.day}일째 완료, 행동 ${main.actions}회 (모든 콘텐츠를 보는 데 드는 양)`);
console.log(
  "일별 새 인물: " + [...main.peoplePerDay].sort((a, b) => a[0] - b[0]).map(([d, n]) => `${d}일 ${n}명`).join(", "),
);
console.log("해결 방법이 처음 가능해지는 날 (샌드박스, 여러 선택 경로 중 가장 이른 날):");
for (const q of quests) {
  const firstDay = (id: string) => Math.min(...allRuns.map((r) => r.solutionReadyDay.get(id) ?? Infinity));
  const fmt = (d: number) => (d === Infinity ? "-" : `${d}일`);
  console.log(`  ${q.title}${q.recovery ? " (회복)" : ""}: ` + q.solutions.map((sol) => `${sol.title} ${fmt(firstDay(sol.id))}`).join(" · "));
}
console.log("");

const questTitle = (id: string) => quests.find((q) => q.id === id)?.title ?? id;
const mainTitle = (id?: string) => mainQuest?.solutions.find((x) => x.id === id)?.title ?? "실패";
console.log(`실제 규칙 (행동력 ${PLAY_RULES.actionPointsPerDay}, ${LAST_DAY}일, 소원해짐 ${PLAY_RULES.driftAfterDays}일):`);
for (const p of plays) {
  const stats = STAT_IDS.map((id) => `${id} ${p.stats[id]}`).join(" ");
  const drops = p.events.filter((e) => e.type === "friendship_level_down").length;
  console.log(
    `  [${p.focus ? mainTitle(p.focus) : "자유"}] 극장: ${mainTitle(p.mainSolution)}${p.mainDay ? ` (${p.mainDay}일)` : ""}` +
      ` · 해결 ${p.completed.length} · 놓침 ${p.failed.length} · 행동 ${p.actions} · 친밀도 하락 ${drops} · ${stats}`,
  );
  if (p.failed.length) console.log(`      놓친 문제: ${p.failed.map(questTitle).join(", ")}`);
}
console.log("");

if (warnings.length) {
  console.log(`경고 ${warnings.length}건`);
  warnings.forEach((w) => console.log(`  ⚠ ${w}`));
  console.log("");
}
if (errors.length) {
  console.log(`오류 ${errors.length}건`);
  errors.forEach((e) => console.log(`  ✗ ${e}`));
  process.exit(1);
}
console.log("No broken references.");
console.log("No unreachable content.");
console.log("No unsolvable quests.");

