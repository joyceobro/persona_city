// 대화: 하루에 한 사람당 한 번. 새 대화가 있으면 그것을, 없으면 관심사 기반 잡담.
// 잡담으로는 아는 사람까지만 가까워진다. 가까운 친구는 함께 문제를 풀어야 된다 (DESIGN_v2 §2).

import type { Person, SaveData } from "../types/game";
import { areConditionsMet } from "./conditions";
import { withJosa } from "./labels";
import { addFriendshipXp, applyEffects, type Ctx } from "./progression";
import { SMALL_TALK_MAX_LEVEL, XP_NEW_TALK, XP_SMALL_TALK } from "./rules";
import { canAct } from "./time";

/** 오늘 이 사람과 대화할 수 있나 (행동력 포함) */
export function canTalkToday(state: SaveData, personId: string): boolean {
  return canAct(state) && state.discoveredPeople.includes(personId) && !state.talkedToday.includes(personId);
}

/** @returns 대화했으면 true (행동력을 쓴다) */
export function talk(ctx: Ctx, personId: string): boolean {
  const { state, content } = ctx;
  const person = content.people.find((p) => p.id === personId);
  if (!person || !canTalkToday(state, personId)) return false;
  state.talkedToday.push(personId);

  const next = person.talks.find((t) => !state.seenTalkIds.includes(t.id) && areConditionsMet(state, t.conditions));
  if (next) {
    state.seenTalkIds.push(next.id);
    ctx.events.push({ type: "talk", personId, text: next.text, isNew: true });
    applyEffects(ctx, next.effects);
    addFriendshipXp(ctx, personId, XP_NEW_TALK);
  } else {
    ctx.events.push({ type: "talk", personId, text: smallTalk(person, state.day), isNew: false });
    addFriendshipXp(ctx, personId, XP_SMALL_TALK, SMALL_TALK_MAX_LEVEL);
  }
  return true;
}

function smallTalk(person: Person, day: number): string {
  const topic = person.interests[day % person.interests.length] ?? "요즘 동네";
  return `${withJosa(person.name, "와/과")} ${topic} 이야기를 한참 나눴다.`;
}
