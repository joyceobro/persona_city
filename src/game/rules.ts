// 게임 규칙 수치. 콘텐츠(JSON)와 분리해 여기서만 조정한다. 근거는 DESIGN_v2.md.

import type { FriendshipLevel, StatId } from "../types/game";

/** 누적 경험치가 이 값 이상이면 해당 단계 */
export const FRIENDSHIP_THRESHOLDS: Record<Exclude<FriendshipLevel, 0>, number> = {
  1: 10,
  2: 40,
  3: 90,
};

/**
 * 처음 듣는 대화 (콘텐츠의 talks). 이야기 두 개(20+20)면 친구 문턱(40).
 * 한 사람의 이야기는 많아야 4개(80)라 대화만으로는 가까운 친구(90)가 되지 않는다.
 */
export const XP_NEW_TALK = 20;
/** 새 대화가 없을 때의 가벼운 잡담. 아는 사람(1)까지만 올린다 */
export const XP_SMALL_TALK = 10;
export const SMALL_TALK_MAX_LEVEL: FriendshipLevel = 1;
/** 문제를 함께 해결한 사람(해결 조건에 친밀도가 걸린 사람)이 받는 경험치. 가까운 친구(3)로 가는 길 */
export const XP_SOLVED_TOGETHER = 20;

export const STAT_IDS: StatId[] = ["vitality", "trust", "livelihood"];
export const STAT_START = 30;
export const STAT_MAX = 100;

/**
 * 시뮬레이션(검증 스크립트)이 바꿔 끼울 수 있는 규칙 묶음.
 * 게임 화면은 항상 DEFAULT_RULES 를 쓴다.
 */
export type Rules = {
  /** 하루 행동력. 대화·탐험·해결이 1씩 쓴다 */
  actionPointsPerDay: number;
  /** 친구(2) 이상과 이 날수 동안 만나지 않으면 소원해진다 */
  driftAfterDays: number;
  /** 소원해진 동안 하루에 깎이는 경험치 */
  driftXpPerDay: number;
  /** false 면 기한·악화·실패가 없다 (콘텐츠 도달 가능성 검사용) */
  deadlines: boolean;
};

export const DEFAULT_RULES: Rules = {
  actionPointsPerDay: 4,
  driftAfterDays: 4,
  driftXpPerDay: 5,
  deadlines: true,
};

export function levelForXp(xp: number): FriendshipLevel {
  if (xp >= FRIENDSHIP_THRESHOLDS[3]) return 3;
  if (xp >= FRIENDSHIP_THRESHOLDS[2]) return 2;
  if (xp >= FRIENDSHIP_THRESHOLDS[1]) return 1;
  return 0;
}

/** 이 단계에 머무를 수 있는 최대 경험치 (다음 단계 문턱 - 1) */
export function maxXpForLevel(level: FriendshipLevel): number {
  return level >= 3 ? Infinity : FRIENDSHIP_THRESHOLDS[(level + 1) as 1 | 2 | 3] - 1;
}
