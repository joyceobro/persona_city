// NPC 간 관계의 자동 발견.

import { areConditionsMet } from "./conditions";
import { discoverRelationship } from "./discovery";
import type { Ctx } from "./progression";

/**
 * discoverConditions 가 있는 관계 중, 양쪽 인물을 모두 알고 조건을 만족한 관계를 발견 처리한다.
 * 조건이 없는 관계는 대화/퀘스트 효과로만 발견된다.
 * @returns 새로 발견한 관계가 있으면 true
 */
export function autoDiscoverRelationships(ctx: Ctx): boolean {
  const { state, content } = ctx;
  let changed = false;
  for (const rel of content.relationships) {
    if (!rel.discoverConditions?.length || state.discoveredRelationships.includes(rel.id)) continue;
    const bothKnown = state.discoveredPeople.includes(rel.from) && state.discoveredPeople.includes(rel.to);
    if (bothKnown && areConditionsMet(state, rel.discoverConditions)) {
      discoverRelationship(ctx, rel.id);
      changed = true;
    }
  }
  return changed;
}
