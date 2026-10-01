// localStorage 저장/불러오기.
// 콘텐츠 JSON 은 개발 중에 계속 바뀌므로, 불러올 때 현재 콘텐츠 기준으로 정규화한다:
//  - 지금은 없는 ID 는 버린다
//  - 빠진 필드는 기본값으로 채운다
//  - 시작 상태의 장소/사람/퀘스트는 항상 포함한다
//  - 새로 생긴 해금 조건을 다시 계산한다 (settle)
//  - v1 저장(행동력·지표·기한 이전)은 v2 기본값을 채워 이어서 한다

import type { FriendshipLevel, GameContent, LoggedEvent, SaveData } from "../types/game";
import { discoverPerson } from "./discovery";
import { createInitialState, initialStats } from "./gameState";
import { settle, type Ctx } from "./progression";
import { DEFAULT_RULES, levelForXp, STAT_IDS, STAT_MAX } from "./rules";

export const SAVE_KEY = "persona-city/save/v1";

export function saveGame(state: SaveData): boolean {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false; // 저장소 차단/용량 초과: 게임은 계속 진행
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // 무시
  }
}

/** 저장된 게임이 있으면 정규화해서 반환, 없거나 읽을 수 없으면 새 게임 */
export function loadGame(content: GameContent): { state: SaveData; restored: boolean } {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(SAVE_KEY);
  } catch {
    // 저장소 접근 불가
  }
  if (!raw) return { state: createInitialState(content), restored: false };

  try {
    return { state: normalize(content, JSON.parse(raw)), restored: true };
  } catch {
    return { state: createInitialState(content), restored: false };
  }
}

function ids(value: unknown, known: Set<string>): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((v): v is string => typeof v === "string" && known.has(v)))];
}

function dayMap(value: unknown, known: Set<string>, fallback: number): Record<string, number> {
  const out: Record<string, number> = {};
  if (!value || typeof value !== "object") return out;
  for (const [id, day] of Object.entries(value)) {
    if (known.has(id)) out[id] = Number.isInteger(day) && (day as number) >= 1 ? (day as number) : fallback;
  }
  return out;
}

export function normalize(content: GameContent, data: Partial<Omit<SaveData, "version">> & { version?: number }): SaveData {
  if (data?.version !== 1 && data?.version !== 2) throw new Error("unsupported save version");

  const people = new Set(content.people.map((p) => p.id));
  const locations = new Set(content.locations.map((l) => l.id));
  const relationships = new Set(content.relationships.map((r) => r.id));
  const quests = new Set(content.quests.map((q) => q.id));
  const infos = new Set(content.people.flatMap((p) => p.discoverableInfo.map((i) => i.id)));
  const talks = new Set(content.people.flatMap((p) => p.talks.map((t) => t.id)));

  const discoveredPeople = ids(data.discoveredPeople, people);
  const friendships: SaveData["friendships"] = {};
  for (const id of discoveredPeople) {
    const xp = Number(data.friendships?.[id]?.experience) || 0;
    friendships[id] = { personId: id, level: levelForXp(xp) as FriendshipLevel, experience: xp };
  }

  const completedQuests = (Array.isArray(data.completedQuests) ? data.completedQuests : []).filter(
    (c) => quests.has(c?.questId) && content.quests.find((q) => q.id === c.questId)?.solutions.some((s) => s.id === c.solutionId),
  );
  const completedIds = new Set(completedQuests.map((c) => c.questId));
  const failedQuests = ids(data.failedQuests, quests).filter((id) => !completedIds.has(id));
  const day = Math.max(1, Math.floor(Number(data.day)) || 1);

  const stats = initialStats();
  for (const id of STAT_IDS) {
    const v = Number(data.stats?.[id]);
    if (Number.isFinite(v)) stats[id] = Math.max(0, Math.min(STAT_MAX, Math.round(v)));
  }

  const ctx: Ctx = {
    content,
    events: [],
    rules: DEFAULT_RULES,
    state: {
      version: 2,
      discoveredLocations: [...new Set([...content.start.locations, ...ids(data.discoveredLocations, locations)])],
      discoveredPeople,
      friendships,
      discoveredRelationships: ids(data.discoveredRelationships, relationships),
      discoveredInfo: ids(data.discoveredInfo, infos),
      currentQuestIds: [...new Set([...content.start.quests, ...ids(data.currentQuestIds, quests)])].filter(
        (id) => !completedIds.has(id) && !failedQuests.includes(id),
      ),
      completedQuests,
      seenTalkIds: ids(data.seenTalkIds, talks),
      day,
      talkedToday: ids(data.talkedToday, people).filter((id) => discoveredPeople.includes(id)),
      exploredToday: ids(data.exploredToday, locations),
      actionPoints: Number.isInteger(data.actionPoints)
        ? Math.max(0, Math.min(DEFAULT_RULES.actionPointsPerDay, data.actionPoints as number))
        : DEFAULT_RULES.actionPointsPerDay,
      stats,
      // v1 저장에는 공개일이 없다: 이어서 하는 날을 공개일로 본다
      questUnlockedDay: dayMap(data.questUnlockedDay, quests, day),
      worsenedQuests: ids(data.worsenedQuests, quests),
      failedQuests,
      lastContactDay: dayMap(data.lastContactDay, people, day),
      ended: data.ended === true,
      log: (Array.isArray(data.log) ? data.log : []).filter(
        (entry) => Number.isInteger(entry?.day) && isValidLoggedEvent(entry.event),
      ),
    },
  };
  for (const id of content.start.people) discoverPerson(ctx, id, { silent: true });
  for (const id of ctx.state.currentQuestIds) ctx.state.questUnlockedDay[id] ??= day;
  for (const id of discoveredPeople) ctx.state.lastContactDay[id] ??= day;
  settle(ctx);
  return ctx.state;

  /** 기록 속 ID 가 지금 콘텐츠에 없으면 그 기록은 버린다 (화면에서 이름을 찾을 수 없으므로) */
  function isValidLoggedEvent(e: unknown): e is LoggedEvent {
    if (!e || typeof e !== "object") return false;
    const ev = e as Record<string, unknown>;
    const has = (set: Set<string>, key: string) => typeof ev[key] === "string" && set.has(ev[key] as string);
    switch (ev.type) {
      case "person_discovered":
      case "friendship_level_up":
      case "friendship_level_down":
      case "drifting":
        return has(people, "personId");
      case "info_discovered":
        return has(people, "personId") && has(infos, "infoId");
      case "location_discovered":
        return has(locations, "locationId");
      case "relationship_discovered":
        return has(relationships, "relationshipId");
      case "quest_unlocked":
      case "quest_worsened":
      case "quest_failed":
        return has(quests, "questId");
      case "quest_completed":
        return has(quests, "questId") && typeof ev.solutionId === "string";
      default:
        return false;
    }
  }
}
