// 하루의 흐름: 행동력, 하루 마치기, 소원해짐, 마지막 날 (DESIGN_v2 §1, §3, §7).

import type { GameContent, SaveData } from "../types/game";
import { loseFriendshipXp, type Ctx } from "./progression";
import { advanceQuests } from "./quests";
import type { Rules } from "./rules";

/** 행동(대화·탐험·해결)을 할 수 있나 */
export function canAct(state: SaveData): boolean {
  return !state.ended && state.actionPoints > 0;
}

/** 게임의 마지막 날 = 큰 목표의 기한 날. 기한이 없으면 끝나지 않는다 */
export function lastDay(content: GameContent): number {
  const main = content.quests.find((q) => q.id === content.start.mainQuest);
  return main?.deadline?.kind === "on_day" ? main.deadline.day : Infinity;
}

/** 친구(2) 이상인데 오래 만나지 않았다 */
export function isDrifting(state: SaveData, rules: Rules, personId: string): boolean {
  const f = state.friendships[personId];
  if (!f || f.level < 2) return false;
  return state.day - (state.lastContactDay[personId] ?? state.day) >= rules.driftAfterDays;
}

export function endDay(ctx: Ctx): void {
  const { state, content, rules } = ctx;
  if (state.ended) return;
  if (rules.deadlines && state.day >= lastDay(content)) {
    state.ended = true;
    state.actionPoints = 0;
    ctx.events.push({ type: "game_ended" });
    return;
  }

  state.day += 1;
  state.talkedToday = [];
  state.exploredToday = [];
  state.actionPoints = rules.actionPointsPerDay;
  ctx.events.push({ type: "day_started", day: state.day });

  for (const personId of state.discoveredPeople) {
    if (!isDrifting(state, rules, personId)) continue;
    const gap = state.day - (state.lastContactDay[personId] ?? state.day);
    // 소원해진 첫날은 알리기만 하고, 다음 날부터 경험치를 잃는다
    if (gap === rules.driftAfterDays) ctx.events.push({ type: "drifting", personId });
    else loseFriendshipXp(ctx, personId, rules.driftXpPerDay);
  }

  if (rules.deadlines) advanceQuests(ctx);
}
