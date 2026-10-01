import type { FriendshipLevel, QuestCategory, Rarity, Relationship, RelationshipType } from "../types/game";

export const FRIENDSHIP_LABELS: Record<FriendshipLevel, string> = {
  0: "모르는 사람",
  1: "아는 사람",
  2: "친구",
  3: "가까운 친구",
};

export const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  friend: "친구",
  family: "가족",
  coworker: "동료",
  neighbor: "이웃",
  mentor: "멘토",
  student: "제자",
  business: "일로 아는 사이",
  rival: "라이벌",
  old_friend: "오랜 친구",
  hobby_friend: "취미 친구",
};

export const RARITY_STARS: Record<Rarity, number> = { common: 1, uncommon: 2, rare: 3 };

export const QUEST_CATEGORY_LABELS: Record<QuestCategory, string> = {
  community: "동네 일",
  personal: "개인 부탁",
  mystery: "수수께끼",
  local: "골목 일",
};

/**
 * `viewerId` 입장에서 상대가 어떤 사람인지. mentor/student 는 방향이 있다.
 * 예: rel(from=A, to=B, mentor) → A 에게 B 는 "제자", B 에게 A 는 "멘토".
 */
export function relationshipLabelFor(rel: Relationship, viewerId: string): string {
  const viewerIsFrom = rel.from === viewerId;
  if (rel.type === "mentor") return viewerIsFrom ? RELATIONSHIP_LABELS.student : RELATIONSHIP_LABELS.mentor;
  if (rel.type === "student") return viewerIsFrom ? RELATIONSHIP_LABELS.mentor : RELATIONSHIP_LABELS.student;
  return RELATIONSHIP_LABELS[rel.type];
}

/** 받침이 있을 때 쓰는 조사 → 없을 때 쓰는 조사 */
const JOSA_PAIRS = {
  "을/를": ["을", "를"],
  "이/가": ["이", "가"],
  "은/는": ["은", "는"],
  "와/과": ["과", "와"],
} as const satisfies Record<string, readonly [string, string]>;

/** 받침 유무에 따라 조사를 붙인다. 예: withJosa("권경자", "와/과") → "권경자와" */
export function withJosa(word: string, pair: keyof typeof JOSA_PAIRS): string {
  const [withBatchim, withoutBatchim] = JOSA_PAIRS[pair];
  // 따옴표·괄호 같은 끝 문장부호는 건너뛰고 마지막 글자로 받침을 판단한다
  const stem = word.replace(/[\s'"’”)\]』」]+$/u, "");
  const last = stem.charCodeAt(stem.length - 1);
  const isHangul = last >= 0xac00 && last <= 0xd7a3;
  const hasBatchim = isHangul && (last - 0xac00) % 28 !== 0;
  return word + (hasBatchim ? withBatchim : withoutBatchim);
}
