import type { Condition, GameContent, SaveData } from "../types/game";
import { FRIENDSHIP_LABELS, withJosa } from "./labels";

export function isConditionMet(state: SaveData, c: Condition): boolean {
  switch (c.type) {
    case "person_discovered":
      return state.discoveredPeople.includes(c.personId);
    case "friendship":
      return (state.friendships[c.personId]?.level ?? -1) >= c.level;
    case "location_discovered":
      return state.discoveredLocations.includes(c.locationId);
    case "relationship_discovered":
      return state.discoveredRelationships.includes(c.relationshipId);
    case "info_discovered":
      return state.discoveredInfo.includes(c.infoId);
    case "quest_unlocked":
      return state.currentQuestIds.includes(c.questId) || isQuestCompleted(state, c.questId);
    case "quest_completed":
      return isQuestCompleted(state, c.questId);
  }
}

export function areConditionsMet(state: SaveData, conditions: Condition[] | undefined): boolean {
  return (conditions ?? []).every((c) => isConditionMet(state, c));
}

export function isQuestCompleted(state: SaveData, questId: string): boolean {
  return state.completedQuests.some((q) => q.questId === questId);
}

/**
 * 잠긴 정보 옆에 보여 줄 힌트. 아직 만나지 않은 사람의 이름은 "누군가"로 가린다.
 */
export function conditionHint(content: GameContent, state: SaveData, c: Condition): string {
  const personName = (id: string) =>
    state.discoveredPeople.includes(id) ? (content.people.find((p) => p.id === id)?.name ?? "누군가") : "누군가";

  switch (c.type) {
    case "person_discovered":
      return `${withJosa(personName(c.personId), "을/를")} 만나면`;
    case "friendship":
      return c.level <= 1
        ? `${withJosa(personName(c.personId), "와/과")} 이야기를 나누면`
        : `${withJosa(personName(c.personId), "와/과")} ${withJosa(FRIENDSHIP_LABELS[c.level], "이/가")} 되면`;
    case "location_discovered":
      return "새로운 장소를 알게 되면";
    case "relationship_discovered": {
      const rel = content.relationships.find((r) => r.id === c.relationshipId);
      return rel
        ? `${withJosa(personName(rel.from), "와/과")} ${personName(rel.to)}의 관계를 알게 되면`
        : "어떤 관계를 알게 되면";
    }
    case "info_discovered":
      return "관련된 이야기를 알게 되면";
    case "quest_unlocked":
    case "quest_completed": {
      const quest = content.quests.find((q) => q.id === c.questId);
      const title = quest && isConditionMet(state, { type: "quest_unlocked", questId: quest.id }) ? `'${quest.title}'` : "어떤 문제";
      return c.type === "quest_completed" ? `${withJosa(title, "을/를")} 해결하면` : `${title}에 관여하면`;
    }
  }
}
