import type { Quest, StatId } from "../../types/game";
import { peopleById, questsById } from "../../data";
import { isConditionMet } from "../../game/conditions";
import { QUEST_CATEGORY_LABELS, STAT_LABELS } from "../../game/labels";
import { daysLeft, solutionStatus, statChangesOf } from "../../game/quests";
import { STAT_IDS } from "../../game/rules";
import { knownQuests } from "../../game/selectors";
import { canAct } from "../../game/time";
import { useGame } from "../GameContext";

type Props = {
  /** 없으면 해결 버튼을 숨긴다 (읽기 전용 화면용) */
  onSolve?: (questId: string, solutionId: string) => void;
};

export function QuestPanel({ onSolve }: Props) {
  const { content, state } = useGame();
  const { current, completed } = knownQuests(content, state);
  // 마감이 가까운 문제부터
  const sorted = [...current].sort((a, b) => (daysLeft(state, a) ?? 99) - (daysLeft(state, b) ?? 99));
  const failed = state.failedQuests.map((id) => questsById.get(id)).filter((q): q is Quest => !!q);

  return (
    <div className="quest-panel">
      <h2>진행 중인 문제</h2>
      {sorted.length === 0 && (
        <p className="muted">
          지금은 풀어야 할 문제가 없다. 동네 사람들과 이야기하다 보면, 또는 며칠 지나면 새 일이 생긴다.
        </p>
      )}
      {sorted.map((q) => (
        <QuestItem key={q.id} quest={q} onSolve={onSolve} />
      ))}

      {failed.length > 0 && (
        <>
          <h2>놓친 문제</h2>
          {failed.map((q) => (
            <QuestItem key={q.id} quest={q} />
          ))}
        </>
      )}

      {completed.length > 0 && (
        <>
          <h2>해결한 문제</h2>
          {completed.map((q) => (
            <QuestItem key={q.id} quest={q} />
          ))}
        </>
      )}
    </div>
  );
}

function DeadlineBadge({ quest }: { quest: Quest }) {
  const { state } = useGame();
  const left = daysLeft(state, quest);
  if (left === undefined) return null;
  const label = left <= 0 ? "오늘까지" : `D-${left}`;
  return <span className={`deadline ${left <= 1 ? "deadline--urgent" : left <= 3 ? "deadline--soon" : ""}`}>{label}</span>;
}

/** 해결했을 때의 지표 변화. 대가가 있는 방법은 빨간 숫자로 보인다 */
export function StatChips({ changes }: { changes: Partial<Record<StatId, number>> }) {
  const ids = STAT_IDS.filter((id) => changes[id]);
  if (ids.length === 0) return null;
  return (
    <span className="stat-chips">
      {ids.map((id) => (
        <span key={id} className={`stat-chip stat-chip--${id} ${changes[id]! > 0 ? "up" : "down"}`}>
          {STAT_LABELS[id]} {changes[id]! > 0 ? "+" : ""}
          {changes[id]}
        </span>
      ))}
    </span>
  );
}

function QuestItem({ quest, onSolve }: { quest: Quest; onSolve?: Props["onSolve"] }) {
  const { state, openPerson, isFresh } = useGame();
  const done = state.completedQuests.find((c) => c.questId === quest.id);
  const failed = state.failedQuests.includes(quest.id);
  const worsened = state.worsenedQuests.includes(quest.id);
  const active = !done && !failed;
  const isNew = active && isFresh("quests", quest.id);

  return (
    <article
      className={[
        "quest",
        done ? "quest--done" : "",
        failed ? "quest--failed" : "",
        worsened && active ? "quest--worsened" : "",
        isNew ? "quest--fresh" : "",
      ].join(" ")}
    >
      <header>
        <span className="quest__category">{QUEST_CATEGORY_LABELS[quest.category]}</span>
        {quest.recovery && <span className="quest__category quest__category--recovery">다시 잇기</span>}
        <h3>{quest.title}</h3>
        {isNew && <span className="new-tag">NEW</span>}
        {active && <DeadlineBadge quest={quest} />}
        {failed && <span className="deadline deadline--missed">놓침</span>}
      </header>
      <p>{quest.description}</p>
      {worsened && quest.worsen && <p className="quest__worsened">{quest.worsen.description}</p>}

      <h4>관련된 사람</h4>
      <ul className="checklist">
        {quest.relatedPersonIds.map((id) => {
          const known = state.discoveredPeople.includes(id);
          return (
            <li key={id} className={known ? "ok" : "no"}>
              {known ? (
                <button className="link" onClick={() => openPerson(id)}>
                  {peopleById.get(id)?.name}
                </button>
              ) : (
                "???"
              )}
            </li>
          );
        })}
      </ul>

      {!failed && (
        <>
          <h4>가능한 접근</h4>
          <div className="solutions">
            {quest.solutions.map((s) => {
              const status = solutionStatus(state, s, quest);
              const chosen = done?.solutionId === s.id;
              if (status === "hidden" && !chosen) {
                return (
                  <div key={s.id} className="solution solution--hidden">
                    ??? <small>아직 찾지 못한 방법</small>
                  </div>
                );
              }
              if (status === "lost" && !chosen) {
                return (
                  <div key={s.id} className="solution solution--lost">
                    <div className="solution__title">{s.title}</div>
                    <small>때를 놓쳐 더는 쓸 수 없는 방법</small>
                  </div>
                );
              }
              return (
                <div key={s.id} className={`solution ${chosen ? "solution--chosen" : ""}`}>
                  <div className="solution__title">
                    {s.title}
                    {chosen && <span className="badge">이 방법으로 해결</span>}
                  </div>
                  <p className="muted">{s.description}</p>
                  <StatChips changes={statChangesOf(quest, s)} />
                  <ul className="checklist">
                    {s.requirements.map((r, i) => (
                      <li key={i} className={isConditionMet(state, r.condition) ? "ok" : "no"}>
                        {r.label}
                      </li>
                    ))}
                  </ul>
                  {active && onSolve && (
                    <button
                      className="btn"
                      disabled={status !== "ready" || !canAct(state)}
                      onClick={() => onSolve(quest.id, s.id)}
                    >
                      이 방법으로 해결하기
                    </button>
                  )}
                  {active && onSolve && status === "ready" && !canAct(state) && !state.ended && (
                    <small className="muted solution__hint">오늘은 기운이 다했다. 내일 해결할 수 있다.</small>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </article>
  );
}
