import { createContext, useContext } from "react";
import type { GameAction, GameContent, SaveData } from "../types/game";

export type LastTalk = { personId: string; text: string; isNew: boolean };

/** 아직 확인하지 않은 새 발견. 화면 세션 동안만 유지한다 (저장하지 않음) */
export type FreshKind = "people" | "locations" | "relationships" | "info" | "quests";
export type Fresh = Record<FreshKind, string[]>;
export const EMPTY_FRESH: Fresh = { people: [], locations: [], relationships: [], info: [], quests: [] };

export type GameContextValue = {
  content: GameContent;
  state: SaveData;
  dispatch: (action: GameAction) => void;
  openPerson: (personId: string) => void;
  /** 가장 최근 대화. 인물 상세에서 말풍선으로 보여 준다 */
  lastTalk: LastTalk | null;
  fresh: Fresh;
  isFresh: (kind: FreshKind, id: string) => boolean;
  /** ids 생략 시 해당 종류 전부 확인 처리 */
  markSeen: (kind: FreshKind, ids?: string[]) => void;
};

export const GameContext = createContext<GameContextValue | null>(null);

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used inside <GameContext.Provider>");
  return ctx;
}
