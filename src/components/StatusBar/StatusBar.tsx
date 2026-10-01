// 상단 바 (DESIGN_v2 §8-1): 결정의 날까지 남은 날, 오늘 남은 행동력, 동네 지표 세 가지.

import { useEffect, useRef, useState } from "react";
import type { StatId } from "../../types/game";
import { questsById } from "../../data";
import { STAT_DESCRIPTIONS, STAT_LABELS } from "../../game/labels";
import { DEFAULT_RULES, STAT_IDS, STAT_MAX } from "../../game/rules";
import { lastDay } from "../../game/time";
import { useGame } from "../GameContext";

export function StatusBar() {
  const { content, state } = useGame();
  const final = lastDay(content);
  const left = final - state.day;
  const main = questsById.get(content.start.mainQuest);
  const mainKnown = !!main && state.currentQuestIds.includes(main.id);
  const mainDone = state.completedQuests.some((c) => c.questId === main?.id);

  return (
    <section className="status" aria-label="오늘의 상태">
      <div className="status__clock">
        <span className="status__day">
          <strong>{state.day}</strong>일째
        </span>
        {Number.isFinite(final) && (
          <span className={`status__dday ${left <= 3 && !mainDone ? "status__dday--urgent" : ""}`}>
            {state.ended
              ? "결정의 날이 지났다"
              : `${mainDone ? "이야기가 끝나는 날까지" : mainKnown ? "극장 폐관 결정까지" : "결정의 날까지"} ${left === 0 ? "오늘" : `D-${left}`}`}
          </span>
        )}
      </div>

      <div className="status__ap" aria-label={`오늘 남은 행동 ${state.actionPoints}`}>
        <span className="status__label">오늘의 기운</span>
        <span className="ap-pips">
          {Array.from({ length: DEFAULT_RULES.actionPointsPerDay }, (_, i) => (
            <i key={i} className={i < state.actionPoints ? "on" : ""} />
          ))}
        </span>
      </div>

      <div className="status__stats">
        {STAT_IDS.map((id) => (
          <StatMeter key={id} stat={id} value={state.stats[id]} />
        ))}
      </div>
    </section>
  );
}

function StatMeter({ stat, value }: { stat: StatId; value: number }) {
  const prev = useRef(value);
  const [pop, setPop] = useState<{ amount: number; key: number } | null>(null);

  useEffect(() => {
    const diff = value - prev.current;
    prev.current = value;
    if (diff === 0) return;
    setPop({ amount: diff, key: Date.now() });
    const timer = setTimeout(() => setPop(null), 1800);
    return () => clearTimeout(timer);
  }, [value]);

  return (
    <div className={`stat stat--${stat}`} title={`${STAT_LABELS[stat]}: ${STAT_DESCRIPTIONS[stat]}`}>
      <span className="stat__label">{STAT_LABELS[stat]}</span>
      <span className="stat__bar" aria-hidden>
        <span style={{ width: `${(value / STAT_MAX) * 100}%` }} />
      </span>
      <span className="stat__value">{value}</span>
      {pop && (
        <span key={pop.key} className={`stat__pop ${pop.amount > 0 ? "up" : "down"}`}>
          {pop.amount > 0 ? "+" : ""}
          {pop.amount}
        </span>
      )}
    </div>
  );
}
