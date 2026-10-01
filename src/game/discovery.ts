// 사람/장소/관계/정보의 발견과 장소 탐험.

import type { SaveData } from "../types/game";
import { areConditionsMet } from "./conditions";
import { applyEffects, type Ctx } from "./progression";

export function discoverPerson(ctx: Ctx, personId: string, options: { silent?: boolean } = {}): void {
  const { state, content } = ctx;
  if (state.discoveredPeople.includes(personId)) return;
  const person = content.people.find((p) => p.id === personId);
  if (!person) return;

  state.discoveredPeople.push(personId);
  state.friendships[personId] = { personId, level: 0, experience: 0 };
  // 조건 없는 정보는 카드를 얻는 순간 공개된다 (이벤트 없이: 카드 획득 자체가 이벤트)
  for (const info of person.discoverableInfo) {
    if (!info.unlock?.length && !state.discoveredInfo.includes(info.id)) state.discoveredInfo.push(info.id);
  }
  if (!options.silent) ctx.events.push({ type: "person_discovered", personId });
}

export function discoverLocation(ctx: Ctx, locationId: string): void {
  if (ctx.state.discoveredLocations.includes(locationId)) return;
  ctx.state.discoveredLocations.push(locationId);
  ctx.events.push({ type: "location_discovered", locationId });
}

export function discoverRelationship(ctx: Ctx, relationshipId: string): void {
  if (ctx.state.discoveredRelationships.includes(relationshipId)) return;
  const rel = ctx.content.relationships.find((r) => r.id === relationshipId);
  if (!rel) return;
  ctx.state.discoveredRelationships.push(relationshipId);
  ctx.events.push({ type: "relationship_discovered", relationshipId });
  applyEffects(ctx, rel.unlocks);
}

export function discoverInfo(ctx: Ctx, infoId: string): void {
  if (ctx.state.discoveredInfo.includes(infoId)) return;
  const person = ctx.content.people.find((p) => p.discoverableInfo.some((i) => i.id === infoId));
  if (!person) return;
  ctx.state.discoveredInfo.push(infoId);
  ctx.events.push({ type: "info_discovered", infoId, personId: person.id });
}

export function canExploreToday(state: SaveData, locationId: string): boolean {
  return state.discoveredLocations.includes(locationId) && !state.exploredToday.includes(locationId);
}

/**
 * 장소마다 하루 한 번. 탐험 한 번에 새 인물은 최대 한 명.
 * 조건을 만족하는 사람이 없으면 nothing_found.
 */
export function explore(ctx: Ctx, locationId: string): void {
  const { state, content } = ctx;
  if (!canExploreToday(state, locationId)) return;
  state.exploredToday.push(locationId);

  const found = content.people.find(
    (p) =>
      p.locations.includes(locationId) &&
      !state.discoveredPeople.includes(p.id) &&
      areConditionsMet(state, p.discoverConditions),
  );
  if (found) discoverPerson(ctx, found.id);
  else ctx.events.push({ type: "nothing_found", locationId });
}
