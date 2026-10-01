// SaveData + 콘텐츠에서 화면에 필요한 값을 뽑는 순수 함수들.

import type { GameContent, Person, PersonInfo, Quest, Relationship, SaveData } from "../types/game";

export function knownInfo(state: SaveData, person: Person): { known: PersonInfo[]; locked: PersonInfo[] } {
  const known: PersonInfo[] = [];
  const locked: PersonInfo[] = [];
  for (const info of person.discoverableInfo) {
    (state.discoveredInfo.includes(info.id) ? known : locked).push(info);
  }
  return { known, locked };
}

export function friendshipLevel(state: SaveData, personId: string) {
  return state.friendships[personId]?.level ?? 0;
}

export function discoveredRelationshipsOf(content: GameContent, state: SaveData, personId: string): Relationship[] {
  return content.relationships.filter(
    (r) => (r.from === personId || r.to === personId) && state.discoveredRelationships.includes(r.id),
  );
}

export function discoveredPeopleAt(content: GameContent, state: SaveData, locationId: string): Person[] {
  return content.people.filter((p) => p.locations.includes(locationId) && state.discoveredPeople.includes(p.id));
}

/** 플레이어가 알고 있는(진행 중 또는 완료) 퀘스트 */
export function knownQuests(content: GameContent, state: SaveData): { current: Quest[]; completed: Quest[] } {
  const completedIds = new Set(state.completedQuests.map((q) => q.questId));
  return {
    current: content.quests.filter((q) => state.currentQuestIds.includes(q.id) && !completedIds.has(q.id)),
    completed: content.quests.filter((q) => completedIds.has(q.id)),
  };
}

export function knownQuestsOf(content: GameContent, state: SaveData, personId: string): Quest[] {
  const { current, completed } = knownQuests(content, state);
  return [...current, ...completed].filter((q) => q.relatedPersonIds.includes(personId));
}
