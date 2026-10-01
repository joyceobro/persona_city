import type { FriendshipLevel, GameAction, GameContent, GameEvent, LoggedEvent, SaveData, StatId } from "../types/game";
import { discoverPerson, explore } from "./discovery";
import { settle, type Ctx } from "./progression";
import { solveQuest } from "./quests";
import { DEFAULT_RULES, STAT_START, type Rules } from "./rules";
import { talk } from "./talk";
import { endDay } from "./time";

export function initialStats(): Record<StatId, number> {
  return { vitality: STAT_START, trust: STAT_START, livelihood: STAT_START };
}

export function createInitialState(content: GameContent, rules: Rules = DEFAULT_RULES): SaveData {
  const { start } = content;
  const ctx: Ctx = {
    content,
    rules,
    events: [],
    state: {
      version: 2,
      discoveredLocations: [...start.locations],
      discoveredPeople: [],
      friendships: {},
      discoveredRelationships: [...start.relationships],
      discoveredInfo: [],
      currentQuestIds: [...start.quests],
      completedQuests: [],
      seenTalkIds: [],
      day: 1,
      talkedToday: [],
      exploredToday: [],
      actionPoints: rules.actionPointsPerDay,
      stats: initialStats(),
      questUnlockedDay: Object.fromEntries(start.quests.map((id) => [id, 1])),
      worsenedQuests: [],
      failedQuests: [],
      lastContactDay: {},
      ended: false,
      log: [],
    },
  };
  for (const id of start.people) discoverPerson(ctx, id, { silent: true });
  settle(ctx);
  return ctx.state;
}

/**
 * 게임의 유일한 상태 전이 함수. 입력 상태는 변경하지 않는다.
 * @param rules 검증 시뮬레이션만 바꿔 끼운다. 게임 화면은 기본값.
 * @returns 새 상태와, UI 가 연출에 쓸 이벤트 목록
 */
export function reduce(
  content: GameContent,
  state: SaveData,
  action: GameAction,
  rules: Rules = DEFAULT_RULES,
): { state: SaveData; events: GameEvent[] } {
  const ctx: Ctx = { content, rules, state: structuredClone(state), events: [] };

  let acted = false;
  switch (action.type) {
    case "explore":
      acted = explore(ctx, action.locationId);
      break;
    case "talk":
      acted = talk(ctx, action.personId);
      break;
    case "solve_quest":
      acted = solveQuest(ctx, action.questId, action.solutionId);
      break;
    case "end_day":
      endDay(ctx);
      break;
  }
  if (acted) ctx.state.actionPoints -= 1;

  settle(ctx);

  for (const event of ctx.events) {
    if (isLogged(event)) ctx.state.log.push({ day: ctx.state.day, event });
  }
  if (ctx.state.log.length > LOG_LIMIT) ctx.state.log = ctx.state.log.slice(-LOG_LIMIT);

  return { state: ctx.state, events: ctx.events };
}

export const LOG_LIMIT = 300;

export function isLogged(e: GameEvent): e is LoggedEvent {
  return !["talk", "nothing_found", "day_started", "stat_changed", "game_ended"].includes(e.type);
}

/** 개발용: 모든 콘텐츠가 열린 상태. `?reveal=all` 로 UI 검토에 쓴다. */
export function createRevealAllState(content: GameContent): SaveData {
  const friendships: SaveData["friendships"] = {};
  const lastContactDay: SaveData["lastContactDay"] = {};
  for (const p of content.people) {
    friendships[p.id] = { personId: p.id, level: 3 as FriendshipLevel, experience: 90 };
    lastContactDay[p.id] = 1;
  }
  const [first, ...rest] = content.quests;
  return {
    version: 2,
    discoveredLocations: content.locations.map((l) => l.id),
    discoveredPeople: content.people.map((p) => p.id),
    friendships,
    discoveredRelationships: content.relationships.map((r) => r.id),
    discoveredInfo: content.people.flatMap((p) => p.discoverableInfo.map((i) => i.id)),
    currentQuestIds: rest.map((q) => q.id),
    completedQuests: first ? [{ questId: first.id, solutionId: first.solutions[0].id }] : [],
    seenTalkIds: [],
    day: 1,
    talkedToday: [],
    exploredToday: [],
    actionPoints: DEFAULT_RULES.actionPointsPerDay,
    stats: initialStats(),
    questUnlockedDay: Object.fromEntries(content.quests.map((q) => [q.id, 1])),
    worsenedQuests: [],
    failedQuests: [],
    lastContactDay,
    ended: false,
    log: [],
  };
}
