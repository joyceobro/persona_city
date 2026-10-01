// 게임 규칙 수치. 콘텐츠(JSON)와 분리해 여기서만 조정한다.

import type { FriendshipLevel } from "../types/game";

/** 누적 경험치가 이 값 이상이면 해당 단계 */
export const FRIENDSHIP_THRESHOLDS: Record<Exclude<FriendshipLevel, 0>, number> = {
  1: 10,
  2: 40,
  3: 90,
};

/** 처음 듣는 대화 (콘텐츠의 talks) */
export const XP_NEW_TALK = 15;
/** 새 대화가 없을 때의 가벼운 잡담 */
export const XP_SMALL_TALK = 10;

export function levelForXp(xp: number): FriendshipLevel {
  if (xp >= FRIENDSHIP_THRESHOLDS[3]) return 3;
  if (xp >= FRIENDSHIP_THRESHOLDS[2]) return 2;
  if (xp >= FRIENDSHIP_THRESHOLDS[1]) return 1;
  return 0;
}
