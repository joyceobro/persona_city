import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameAction, GameEvent, SaveData } from "../types/game";
import { content } from "../data";
import { createInitialState, createRevealAllState, reduce } from "../game/gameState";
import { clearSave, loadGame, saveGame } from "../game/save";
import { toMessage, DiscoveryToast, type Toast } from "../components/DiscoveryToast/DiscoveryToast";
import { EMPTY_FRESH, GameContext, type Fresh, type FreshKind, type LastTalk } from "../components/GameContext";
import { momentsFrom, MomentOverlay, type Moment } from "../components/Moments/MomentOverlay";
import { CityMap } from "../components/CityMap/CityMap";
import { PersonDetail } from "../components/PersonDetail/PersonDetail";
import { QuestPanel } from "../components/QuestPanel/QuestPanel";
import { Journal, PeopleCollection } from "../components/Journal/Journal";
import { RelationshipGraph } from "../components/RelationshipGraph/RelationshipGraph";
import { StatusBar } from "../components/StatusBar/StatusBar";
import { Ending } from "../components/Ending/Ending";

type Tab = "city" | "people" | "relations" | "quests" | "journal";

/** 탭 이름과, 그 탭의 새 소식 점을 켜는 새 발견 종류 */
const TABS: { id: Tab; label: string; fresh?: FreshKind }[] = [
  { id: "city", label: "도시", fresh: "locations" },
  { id: "people", label: "사람", fresh: "people" },
  { id: "relations", label: "관계", fresh: "relationships" },
  { id: "quests", label: "문제", fresh: "quests" },
  { id: "journal", label: "기록" },
];

/** 개발 중 UI 검토용: `?reveal=all` 이면 모든 콘텐츠가 열린 상태로 시작 */
const revealAll = import.meta.env.DEV && new URLSearchParams(location.search).get("reveal") === "all";

const FRESH_FROM_EVENT: Partial<Record<GameEvent["type"], [FreshKind, (e: GameEvent) => string]>> = {
  person_discovered: ["people", (e) => (e as { personId: string }).personId],
  location_discovered: ["locations", (e) => (e as { locationId: string }).locationId],
  relationship_discovered: ["relationships", (e) => (e as { relationshipId: string }).relationshipId],
  info_discovered: ["info", (e) => (e as { infoId: string }).infoId],
  quest_unlocked: ["quests", (e) => (e as { questId: string }).questId],
};

export function GamePage() {
  const [state, setState] = useState<SaveData>(() =>
    revealAll ? createRevealAllState(content) : loadGame(content).state,
  );
  const stateRef = useRef(state);
  const [confirmReset, setConfirmReset] = useState(false);

  // 상태가 바뀔 때마다 저장. reveal=all 미리보기는 실제 진행을 덮어쓰지 않도록 저장하지 않는다.
  useEffect(() => {
    if (!revealAll) saveGame(state);
  }, [state]);

  const [tab, setTab] = useState<Tab>("city");
  const [selectedLocation, setSelectedLocation] = useState<string | null>(content.start.locations[0] ?? null);
  const [openPersonId, setOpenPersonId] = useState<string | null>(null);
  const [lastTalk, setLastTalk] = useState<LastTalk | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [fresh, setFresh] = useState<Fresh>(EMPTY_FRESH);
  const [showEnding, setShowEnding] = useState(false);
  const toastSeq = useRef(0);

  const dispatch = useCallback((action: GameAction) => {
    const result = reduce(content, stateRef.current, action);
    stateRef.current = result.state;
    setState(result.state);
    const events = result.events;

    for (const e of events) {
      if (e.type === "talk") setLastTalk({ personId: e.personId, text: e.text, isNew: e.isNew });
    }
    if (action.type === "end_day") setLastTalk(null);
    if (events.some((e) => e.type === "game_ended")) setShowEnding(true);

    // 새 발견 표시
    const added: Partial<Fresh> = {};
    for (const e of events) {
      const rule = FRESH_FROM_EVENT[e.type];
      if (rule) (added[rule[0]] ??= []).push(rule[1](e));
    }
    if (Object.keys(added).length) {
      setFresh((prev) => {
        const next = { ...prev };
        for (const [k, ids] of Object.entries(added) as [FreshKind, string[]][]) next[k] = [...new Set([...prev[k], ...ids])];
        return next;
      });
    }

    // 큰 연출(카드 획득, 퀘스트 완료)과 작은 알림을 나눈다. 같은 내용을 두 번 보여 주지 않는다.
    // 지표 변화는 상단 바가 보여 주므로 알림을 띄우지 않는다.
    const newMoments = momentsFrom(events);
    if (newMoments.length) setMoments((prev) => [...prev, ...newMoments]);
    const questDone = newMoments.some((m) => m.kind === "quest");
    const toastEvents = questDone
      ? []
      : events.filter((e) => e.type !== "person_discovered" && e.type !== "stat_changed" && toMessage(e));
    if (toastEvents.length) {
      setToasts((prev) => [...prev, ...toastEvents.map((event) => ({ id: ++toastSeq.current, event }))].slice(-6));
    }
  }, []);

  const markSeen = useCallback((kind: FreshKind, ids?: string[]) => {
    setFresh((prev) => {
      if (prev[kind].length === 0) return prev;
      return { ...prev, [kind]: ids ? prev[kind].filter((id) => !ids.includes(id)) : [] };
    });
  }, []);
  const isFresh = useCallback((kind: FreshKind, id: string) => fresh[kind].includes(id), [fresh]);

  const changeTab = useCallback(
    (next: Tab) => {
      // 탭을 떠날 때 그 탭의 새 소식을 확인한 것으로 본다 (도시 탭은 장소를 눌러야 확인)
      const leaving = TABS.find((t) => t.id === tab)?.fresh;
      if (leaving && tab !== next && tab !== "city") markSeen(leaving);
      setTab(next);
    },
    [tab, markSeen],
  );

  const selectLocation = useCallback(
    (id: string) => {
      setSelectedLocation(id);
      markSeen("locations", [id]);
    },
    [markSeen],
  );

  const resetGame = useCallback(() => {
    clearSave();
    const initial = createInitialState(content);
    stateRef.current = initial;
    setState(initial);
    setLastTalk(null);
    setToasts([]);
    setMoments([]);
    setFresh(EMPTY_FRESH);
    setOpenPersonId(null);
    setSelectedLocation(content.start.locations[0] ?? null);
    setTab("city");
    setConfirmReset(false);
    setShowEnding(false);
  }, []);

  // 상세를 닫거나 다른 사람으로 넘어가면, 보던 사람의 카드와 새로 알게 된 정보를 확인한 것으로 본다
  const seePerson = useCallback(
    (id: string | null) => {
      if (!id) return;
      markSeen("people", [id]);
      markSeen("info", content.people.find((p) => p.id === id)?.discoverableInfo.map((i) => i.id) ?? []);
    },
    [markSeen],
  );
  const openPerson = useCallback(
    (id: string) => {
      if (openPersonId !== id) seePerson(openPersonId);
      setOpenPersonId(id);
    },
    [openPersonId, seePerson],
  );
  const closePerson = useCallback(() => {
    seePerson(openPersonId);
    setOpenPersonId(null);
  }, [openPersonId, seePerson]);
  const dismissToast = useCallback((id: number) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);
  const closeMoment = useCallback(() => setMoments((prev) => prev.slice(1)), []);

  const ctx = useMemo(
    () => ({ content, state, dispatch, openPerson, lastTalk, fresh, isFresh, markSeen }),
    [state, dispatch, openPerson, lastTalk, fresh, isFresh, markSeen],
  );

  return (
    <GameContext.Provider value={ctx}>
      <div className="app">
        <header className="app-header">
          <h1>
            PERSONA CITY <small>해온시</small>
          </h1>
          {revealAll && <span className="badge badge--dev">reveal=all</span>}
          <div className="day">
            {state.ended ? (
              <button className="btn" onClick={() => setShowEnding(true)}>
                결말 다시 보기
              </button>
            ) : (
              <button
                className={`btn ${state.actionPoints > 0 ? "btn--ghost" : "btn--pulse"}`}
                onClick={() => dispatch({ type: "end_day" })}
              >
                하루 마치기
              </button>
            )}
            {!revealAll &&
              (confirmReset ? (
                <span className="reset-confirm">
                  모든 진행이 지워집니다.
                  <button className="link" onClick={resetGame}>
                    처음부터
                  </button>
                  <button className="link" onClick={() => setConfirmReset(false)}>
                    취소
                  </button>
                </span>
              ) : (
                <button className="link muted" onClick={() => setConfirmReset(true)}>
                  새로 시작
                </button>
              ))}
          </div>
        </header>

        <StatusBar />

        <nav className="tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => changeTab(t.id)}>
              {t.label}
              {t.fresh && fresh[t.fresh].length > 0 && <span className="tab-dot" aria-label="새 소식" />}
            </button>
          ))}
        </nav>

        <main className="app-main">
          {tab === "city" && (
            <CityMap
              selectedId={selectedLocation}
              onSelect={selectLocation}
              onExplore={(locationId) => dispatch({ type: "explore", locationId })}
            />
          )}
          {tab === "people" && <PeopleCollection />}
          {tab === "relations" && <RelationshipGraph />}
          {tab === "quests" && (
            <QuestPanel onSolve={(questId, solutionId) => dispatch({ type: "solve_quest", questId, solutionId })} />
          )}
          {tab === "journal" && <Journal />}
        </main>

        {openPersonId && <PersonDetail personId={openPersonId} onClose={closePerson} />}
        {moments[0] && <MomentOverlay moment={moments[0]} onClose={closeMoment} />}
        {showEnding && !moments[0] && <Ending onClose={() => setShowEnding(false)} onRestart={resetGame} />}
        <footer className="app-footer">
          인물 원형: NVIDIA Nemotron-Personas-Korea (CC BY 4.0) · 모든 인물은 합성 데이터에서 만든 가상 인물입니다.
        </footer>
        <DiscoveryToast toasts={toasts} onDismiss={dismissToast} />
      </div>
    </GameContext.Provider>
  );
}
