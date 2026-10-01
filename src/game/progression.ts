// 효과 적용, 친밀도 성장, 파생 해금(정보/관계)의 정리.
// 모든 액션은 Ctx 의 state 초안(draft)을 직접 수정하고 이벤트를 쌓는다.

import type { Effect, GameContent, GameEvent, SaveData } from "../types/game";
import { areConditionsMet } from "./conditions";
import { discoverInfo, discoverLocation, discoverPerson, discoverRelationship } from "./discovery";
import { unlockQuest } from "./quests";
import { autoDiscoverRelationships } from "./relationships";
import { levelForXp } from "./rules";

export type Ctx = {
  content: GameContent;
  state: SaveData;
  events: GameEvent[];
};

export function addFriendshipXp(ctx: Ctx, personId: string, amount: number): void {
  const f = ctx.state.friendships[personId];
  if (!f) return; // 아직 만나지 않은 사람
  f.experience += amount;
  const next = levelForXp(f.experience);
  if (next > f.level) {
    f.level = next;
    ctx.events.push({ type: "friendship_level_up", personId, level: next });
  }
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
  }
}

export function applyEffects(ctx: Ctx, effects: Effect[] | undefined): void {
  for (const e of effects ?? []) applyEffect(ctx, e);
}

/**
 * 액션 후 조건이 충족된 파생 해금을 더 이상 변화가 없을 때까지 적용한다.
 * - 조건부 인물 정보 (친밀도, 관계, 퀘스트 완료 등)
 * - discoverConditions 가 있는 관계
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
    if (!changed) return;
  }
  throw new Error("settle(): 해금이 수렴하지 않습니다. 콘텐츠의 순환 조건을 확인하세요.");
}
