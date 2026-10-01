// 효과 적용, 친밀도 성장, 파생 해금(정보/관계)의 정리.
// 모든 액션은 Ctx 의 state 초안(draft)을 직접 수정하고 이벤트를 쌓는다.

import type { Effect, FriendshipLevel, GameContent, GameEvent, SaveData, StatId } from "../types/game";
import { areConditionsMet } from "./conditions";
import { discoverInfo, discoverLocation, discoverPerson, discoverRelationship } from "./discovery";
import { appearScheduledQuests, unlockQuest } from "./quests";
import { autoDiscoverRelationships } from "./relationships";
import { FRIENDSHIP_THRESHOLDS, levelForXp, maxXpForLevel, STAT_MAX, type Rules } from "./rules";

export type Ctx = {
  content: GameContent;
  state: SaveData;
  events: GameEvent[];
  rules: Rules;
};

/**
 * 친밀도 경험치를 더한다. 함께한 날로 기록되어 소원해짐이 풀린다.
 * @param maxLevel 이 단계 위로는 올리지 않는다 (대화의 한계, DESIGN_v2 §2). 이미 넘었으면 그대로 둔다.
 */
export function addFriendshipXp(ctx: Ctx, personId: string, amount: number, maxLevel?: FriendshipLevel): void {
  const f = ctx.state.friendships[personId];
  if (!f) return; // 아직 만나지 않은 사람
  ctx.state.lastContactDay[personId] = ctx.state.day;
  const cap = maxLevel === undefined ? Infinity : maxXpForLevel(maxLevel);
  f.experience = Math.max(f.experience, Math.min(f.experience + amount, cap));
  const next = levelForXp(f.experience);
  if (next > f.level) {
    f.level = next;
    ctx.events.push({ type: "friendship_level_up", personId, level: next });
  }
}

/** 소원해짐으로 경험치를 잃는다. 아는 사람(1) 아래로는 떨어지지 않는다 */
export function loseFriendshipXp(ctx: Ctx, personId: string, amount: number): void {
  const f = ctx.state.friendships[personId];
  if (!f) return;
  const floor = Math.min(f.experience, FRIENDSHIP_THRESHOLDS[1]);
  f.experience = Math.max(floor, f.experience - amount);
  const next = levelForXp(f.experience);
  if (next < f.level) {
    f.level = next;
    ctx.events.push({ type: "friendship_level_down", personId, level: next });
  }
}

export function changeStat(ctx: Ctx, stat: StatId, amount: number): void {
  const before = ctx.state.stats[stat];
  const after = Math.max(0, Math.min(STAT_MAX, before + amount));
  ctx.state.stats[stat] = after;
  if (after !== before) ctx.events.push({ type: "stat_changed", stat, amount: after - before });
}

export function applyEffect(ctx: Ctx, effect: Effect): void {
  switch (effect.type) {
    case "discover_person":
      return discoverPerson(ctx, effect.personId);
    case "discover_location":
      return discoverLocation(ctx, effect.locationId);
    case "discover_relationship":
      return discoverRelationship(ctx, effect.relationshipId);
    case "discover_info":
      return discoverInfo(ctx, effect.infoId);
    case "unlock_quest":
      return unlockQuest(ctx, effect.questId);
    case "friendship_xp":
      return addFriendshipXp(ctx, effect.personId, effect.amount);
    case "stat":
      return changeStat(ctx, effect.stat, effect.amount);
  }
}

export function applyEffects(ctx: Ctx, effects: Effect[] | undefined): void {
  for (const e of effects ?? []) applyEffect(ctx, e);
}

/**
 * 액션 후 조건이 충족된 파생 해금을 더 이상 변화가 없을 때까지 적용한다.
 * - 조건부 인물 정보 (친밀도, 관계, 퀘스트 완료 등)
 * - discoverConditions 가 있는 관계
 * - 날짜가 된 문제 (appearsOnDay)
 */
export function settle(ctx: Ctx): void {
  for (let guard = 0; guard < 50; guard++) {
    let changed = false;

    for (const personId of ctx.state.discoveredPeople) {
      const person = ctx.content.people.find((p) => p.id === personId)!;
      for (const info of person.discoverableInfo) {
        if (!ctx.state.discoveredInfo.includes(info.id) && areConditionsMet(ctx.state, info.unlock)) {
          discoverInfo(ctx, info.id);
          changed = true;
        }
      }
    }

    if (autoDiscoverRelationships(ctx)) changed = true;
    if (appearScheduledQuests(ctx)) changed = true;
    if (!changed) return;
  }
  throw new Error("settle(): 해금이 수렴하지 않습니다. 콘텐츠의 순환 조건을 확인하세요.");
}
