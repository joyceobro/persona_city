import type { FriendshipLevel, GameAction, GameContent, GameEvent, LoggedEvent, SaveData } from "../types/game";
import { discoverPerson, explore } from "./discovery";
import { settle, type Ctx } from "./progression";
import { solveQuest } from "./quests";
import { talk } from "./talk";

export function createInitialState(content: GameContent): SaveData {
  const { start } = content;
  const ctx: Ctx = {
    content,
    events: [],
    state: {
      version: 1,
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
      log: [],
    },
  };
  for (const id of start.people) discoverPerson(ctx, id, { silent: true });
  settle(ctx);
  return ctx.state;
}

/**
 * 게임의 유일한 상태 전이 함수. 입력 상태는 변경하지 않는다.
 * @returns 새 상태와, UI 가 연출에 쓸 이벤트 목록
 */
export function reduce(
  content: GameContent,
  state: SaveData,
  action: GameAction,
): { state: SaveData; events: GameEvent[] } {
  const ctx: Ctx = { content, state: structuredClone(state), events: [] };

  switch (action.type) {
    case "explore":
      explore(ctx, action.locationId);
      break;
    case "talk":
      talk(ctx, action.personId);
      break;
    case "solve_quest":
      solveQuest(ctx, action.questId, action.solutionId);
      break;
    case "end_day":
      ctx.state.day += 1;
      ctx.state.talkedToday = [];
      ctx.state.exploredToday = [];
      ctx.events.push({ type: "day_started", day: ctx.state.day });
      break;
  }

  settle(ctx);

  for (const event of ctx.events) {
    if (isLogged(event)) ctx.state.log.push({ day: ctx.state.day, event });
  }
  if (ctx.state.log.length > LOG_LIMIT) ctx.state.log = ctx.state.log.slice(-LOG_LIMIT);

  return { state: ctx.state, events: ctx.events };
}

export const LOG_LIMIT = 300;

export function isLogged(e: GameEvent): e is LoggedEvent {
  return e.type !== "talk" && e.type !== "nothing_found" && e.type !== "day_started";
}

/** 개발용: 모든 콘텐츠가 열린 상태. `?reveal=all` 로 UI 검토에 쓴다. */
export function createRevealAllState(content: GameContent): SaveData {
  const friendships: SaveData["friendships"] = {};
  for (const p of content.people) {
    friendships[p.id] = { personId: p.id, level: 3 as FriendshipLevel, experience: 90 };
  }
  const [first, ...rest] = content.quests;
  return {
    version: 1,
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
    log: [],
  };
}
