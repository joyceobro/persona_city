/**
 * 게임 데이터 검증 (MVP.md §26).  npm run validate:data
 *
 * 1. 스키마: 필수 필드, 빈 문자열, 허용 값, ID 중복
 * 2. 참조 무결성: 존재하지 않는 person/location/relationship/quest/info/talk 참조
 * 3. 관계: 자기 자신과의 관계, 같은 쌍의 중복 관계, 한 사람에게 같은 종류가 과하게 몰린 경우
 * 4. 도달 가능성: 실제 게임 엔진(reduce)으로 성실한 플레이어를 시뮬레이션해
 *    모든 사람/장소/관계/정보/퀘스트/해결 방법에 닿는지 확인한다.
 *    닿지 않는 콘텐츠는 순환 조건이나 누락된 해금 경로를 뜻한다.
 * 5. 밸런스(경고): 하루에 너무 많은 사람이 등장하는지, 퀘스트가 너무 일찍 풀리는지
 *
 * 오류가 있으면 종료 코드 1.
 */

import type { Condition, Effect, GameAction, SaveData } from "../../src/types/game";
import { content } from "../../src/data";
import { createInitialState, reduce } from "../../src/game/gameState";
import { solutionStatus } from "../../src/game/quests";
import { canTalkToday } from "../../src/game/talk";

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
// 4. 도달 가능성 — 실제 엔진으로 성실한 플레이어 시뮬레이션
//    매일: 아는 장소를 모두 탐험 → 만난 모든 사람과 대화 → 퀘스트 해결 → 하루 마치기
//    모든 해결 방법이 열리는지 보려고, 퀘스트는 "모든 방법이 가능해졌을 때" 또는
//    "진전이 한동안 멈췄을 때"(다른 콘텐츠가 이 퀘스트 완료를 기다리는 경우) 해결한다.
// ---------------------------------------------------------------------------
const MAX_DAYS = 60;
const STALL_DAYS = 6; // 잡담 경험치만으로 다음 친밀도 단계까지 걸리는 최대 일수
let s: SaveData = createInitialState(content);
const personDay = new Map<string, number>();
const peoplePerDay = new Map<number, number>();
const solutionReadyDay = new Map<string, number>();
let actions = 0;

function act(a: GameAction) {
  actions++;
  const r = reduce(content, s, a);
  s = r.state;
  for (const e of r.events) {
    if (e.type === "person_discovered") {
      personDay.set(e.personId, s.day);
      peoplePerDay.set(s.day, (peoplePerDay.get(s.day) ?? 0) + 1);
    }
  }
  return r.events;
}
const progressKey = () =>
  [s.discoveredPeople, s.discoveredLocations, s.discoveredRelationships, s.discoveredInfo, s.completedQuests, s.currentQuestIds]
    .map((x) => x.length)
    .join("/") + "/" + Object.values(s.friendships).reduce((n, f) => n + f.level, 0);
const complete = () =>
  s.discoveredPeople.length === people.length &&
  s.discoveredLocations.length === locations.length &&
  s.discoveredRelationships.length === relationships.length &&
  s.discoveredInfo.length === allInfoCount &&
  s.completedQuests.length === quests.length;

let stalled = 0;
while (s.day <= MAX_DAYS && !complete()) {
  const before = progressKey();
  for (const loc of [...s.discoveredLocations]) {
    while (act({ type: "explore", locationId: loc }).some((e) => e.type === "person_discovered")) { /* 더 없을 때까지 */ }
  }
  for (const pid of [...s.discoveredPeople]) if (canTalkToday(s, pid)) act({ type: "talk", personId: pid });

  for (const q of quests) {
    if (!s.currentQuestIds.includes(q.id)) continue;
    for (const sol of q.solutions) {
      if (!solutionReadyDay.has(sol.id) && solutionStatus(s, sol) === "ready") solutionReadyDay.set(sol.id, s.day);
    }
    const allSeen = q.solutions.every((sol) => solutionReadyDay.has(sol.id));
    const ready = q.solutions.find((sol) => solutionStatus(s, sol) === "ready");
    if (ready && (allSeen || stalled >= STALL_DAYS)) act({ type: "solve_quest", questId: q.id, solutionId: ready.id });
  }

  stalled = progressKey() === before ? stalled + 1 : 0;
  if (!complete()) act({ type: "end_day" });
}

const missing = <T extends { id: string }>(all: T[], found: string[]) => all.filter((x) => !found.includes(x.id)).map((x) => x.id);
missing(people, s.discoveredPeople).forEach((id) => err(`도달 불가: 사람 ${id}`));
missing(locations, s.discoveredLocations).forEach((id) => err(`도달 불가: 장소 ${id}`));
missing(relationships, s.discoveredRelationships).forEach((id) => err(`도달 불가: 관계 ${id}`));
[...infoIds].filter((id) => !s.discoveredInfo.includes(id)).forEach((id) => err(`도달 불가: 정보 ${id}`));
for (const q of quests) {
  if (!s.completedQuests.some((c) => c.questId === q.id)) err(`해결 불가: 퀘스트 ${q.id} (${q.title})`);
  for (const sol of q.solutions) if (!solutionReadyDay.has(sol.id)) err(`도달 불가: 해결 방법 ${sol.id} (${sol.title})`);
}

// ---------------------------------------------------------------------------
// 5. 밸런스 경고
// ---------------------------------------------------------------------------
// 탐험은 장소당 하루 1회라 하루 최대 등장 인원은 장소 수로 제한된다. 한 장소에서 몰리는 경우만 경고한다.
const perDayMax = Math.max(0, ...peoplePerDay.values());
if (perDayMax > locations.length) warn(`하루에 새 인물 ${perDayMax}명 등장 — 장소 수(${locations.length})보다 많음`);
for (const q of quests) {
  const days = q.solutions.map((sol) => solutionReadyDay.get(sol.id)).filter((d): d is number => d !== undefined);
  if (!days.length) continue;
  const earliest = Math.min(...days);
  const lastPerson = Math.max(...q.relatedPersonIds.map((id) => personDay.get(id) ?? 1));
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
ok(`${quests.length} quests (${quests.reduce((n, q) => n + q.solutions.length, 0)} solutions)`);
ok(`${allInfoCount} info`);
console.log("");
console.log(`시뮬레이션: ${s.day}일째 완료, 행동 ${actions}회`);
console.log(
  "일별 새 인물: " + [...peoplePerDay].sort((a, b) => a[0] - b[0]).map(([d, n]) => `${d}일 ${n}명`).join(", "),
);
console.log("해결 방법이 처음 가능해지는 날:");
for (const q of quests) {
  console.log(`  ${q.title}: ` + q.solutions.map((sol) => `${sol.title} ${solutionReadyDay.get(sol.id) ?? "-"}일`).join(" · "));
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
