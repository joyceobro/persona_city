// 퀘스트 공개, 해결 가능 여부, 해결.

import type { Quest, QuestSolution, SaveData } from "../types/game";
import { areConditionsMet, isConditionMet, isQuestCompleted } from "./conditions";
import { applyEffects, type Ctx } from "./progression";

export function unlockQuest(ctx: Ctx, questId: string): void {
  const { state } = ctx;
  if (state.currentQuestIds.includes(questId) || isQuestCompleted(state, questId)) return;
  if (!ctx.content.quests.some((q) => q.id === questId)) return;
  state.currentQuestIds.push(questId);
  ctx.events.push({ type: "quest_unlocked", questId });
}

export type SolutionStatus = "hidden" | "blocked" | "ready";

export function solutionStatus(state: SaveData, solution: QuestSolution): SolutionStatus {
  if (!areConditionsMet(state, solution.revealConditions)) return "hidden";
  return solution.requirements.every((r) => isConditionMet(state, r.condition)) ? "ready" : "blocked";
}

export function canSolveAny(state: SaveData, quest: Quest): boolean {
  return quest.solutions.some((s) => solutionStatus(state, s) === "ready");
}

export function solveQuest(ctx: Ctx, questId: string, solutionId: string): void {
  const { state, content } = ctx;
  const quest = content.quests.find((q) => q.id === questId);
  const solution = quest?.solutions.find((s) => s.id === solutionId);
  if (!quest || !solution) return;
  if (!state.currentQuestIds.includes(questId) || isQuestCompleted(state, questId)) return;
  if (solutionStatus(state, solution) !== "ready") return;

  state.currentQuestIds = state.currentQuestIds.filter((id) => id !== questId);
  state.completedQuests.push({ questId, solutionId });
  ctx.events.push({ type: "quest_completed", questId, solutionId });
  applyEffects(ctx, solution.rewards);
  applyEffects(ctx, quest.rewards);
}
