// 퀘스트 공개, 기한·악화·실패, 해결 가능 여부, 해결.

import type { Effect, Quest, QuestSolution, SaveData, StatId } from "../types/game";
import { areConditionsMet, isConditionMet, isQuestCompleted } from "./conditions";
import { addFriendshipXp, applyEffects, type Ctx } from "./progression";
import { XP_SOLVED_TOGETHER } from "./rules";
import { canAct } from "./time";

export function unlockQuest(ctx: Ctx, questId: string): void {
  const { state } = ctx;
  if (state.currentQuestIds.includes(questId) || isQuestCompleted(state, questId) || state.failedQuests.includes(questId)) return;
  if (!ctx.content.quests.some((q) => q.id === questId)) return;
  state.currentQuestIds.push(questId);
  state.questUnlockedDay[questId] ??= state.day;
  ctx.events.push({ type: "quest_unlocked", questId });
}

/** 날짜가 된 문제를 드러낸다. @returns 새로 드러난 문제가 있으면 true */
export function appearScheduledQuests(ctx: Ctx): boolean {
  const { state, content } = ctx;
  let changed = false;
  for (const q of content.quests) {
    if (q.appearsOnDay === undefined || state.day < q.appearsOnDay) continue;
    if (q.giverId && !state.discoveredPeople.includes(q.giverId)) continue;
    if (state.currentQuestIds.includes(q.id) || isQuestCompleted(state, q.id) || state.failedQuests.includes(q.id)) continue;
    unlockQuest(ctx, q.id);
    changed = true;
  }
  return changed;
}

/** 이 날까지 풀 수 있다. 기한이 없으면 undefined */
export function deadlineDay(state: SaveData, quest: Quest): number | undefined {
  const d = quest.deadline;
  if (!d) return undefined;
  if (d.kind === "on_day") return d.day;
  return (state.questUnlockedDay[quest.id] ?? state.day) + d.days - 1;
}

/** 0 = 오늘까지 */
export function daysLeft(state: SaveData, quest: Quest): number | undefined {
  const due = deadlineDay(state, quest);
  return due === undefined ? undefined : due - state.day;
}

export type SolutionStatus = "hidden" | "lost" | "blocked" | "ready";

export function solutionStatus(state: SaveData, solution: QuestSolution, quest?: Quest): SolutionStatus {
  if (quest && state.worsenedQuests.includes(quest.id) && quest.worsen?.hideSolutionIds?.includes(solution.id)) return "lost";
  if (!areConditionsMet(state, solution.revealConditions)) return "hidden";
  return solution.requirements.every((r) => isConditionMet(state, r.condition)) ? "ready" : "blocked";
}

export function canSolveAny(state: SaveData, quest: Quest): boolean {
  return quest.solutions.some((s) => solutionStatus(state, s, quest) === "ready");
}

/** 이 해결 방법으로 풀었을 때의 지표 변화 (해결법 보상 + 공통 보상) */
export function statChangesOf(quest: Quest, solution: QuestSolution): Partial<Record<StatId, number>> {
  const out: Partial<Record<StatId, number>> = {};
  const add = (effects: Effect[] | undefined) => {
    for (const e of effects ?? []) if (e.type === "stat") out[e.stat] = (out[e.stat] ?? 0) + e.amount;
  };
  add(solution.rewards);
  add(quest.rewards);
  return out;
}

/** @returns 해결했으면 true (행동력을 쓴다) */
export function solveQuest(ctx: Ctx, questId: string, solutionId: string): boolean {
  const { state, content } = ctx;
  const quest = content.quests.find((q) => q.id === questId);
  const solution = quest?.solutions.find((s) => s.id === solutionId);
  if (!quest || !solution || !canAct(state)) return false;
  if (!state.currentQuestIds.includes(questId) || isQuestCompleted(state, questId)) return false;
  if (solutionStatus(state, solution, quest) !== "ready") return false;

  state.currentQuestIds = state.currentQuestIds.filter((id) => id !== questId);
  state.completedQuests.push({ questId, solutionId });
  ctx.events.push({ type: "quest_completed", questId, solutionId });
  // 함께 해결한 사람들은 더 가까워진다 (소원해짐도 풀린다)
  for (const r of solution.requirements) {
    if (r.condition.type === "friendship") addFriendshipXp(ctx, r.condition.personId, XP_SOLVED_TOGETHER);
  }
  applyEffects(ctx, solution.rewards);
  applyEffects(ctx, quest.rewards);
  return true;
}

/** 새 날이 시작될 때: 기한이 지난 문제는 실패, 기한이 가까운 문제는 악화 */
export function advanceQuests(ctx: Ctx): void {
  const { state, content } = ctx;
  for (const quest of content.quests) {
    if (!state.currentQuestIds.includes(quest.id)) continue;
    const due = deadlineDay(state, quest);
    if (due === undefined) continue;

    if (state.day > due) {
      state.currentQuestIds = state.currentQuestIds.filter((id) => id !== quest.id);
      state.failedQuests.push(quest.id);
      ctx.events.push({ type: "quest_failed", questId: quest.id });
      applyEffects(ctx, quest.onFail);
    } else if (quest.worsen && !state.worsenedQuests.includes(quest.id) && state.day >= due - quest.worsen.daysBefore) {
      state.worsenedQuests.push(quest.id);
      ctx.events.push({ type: "quest_worsened", questId: quest.id });
      applyEffects(ctx, quest.worsen.effects);
    }
  }
}
