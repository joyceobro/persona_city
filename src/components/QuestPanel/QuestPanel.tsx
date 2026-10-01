import type { Quest } from "../../types/game";
import { peopleById } from "../../data";
import { areConditionsMet, isConditionMet } from "../../game/conditions";
import { QUEST_CATEGORY_LABELS } from "../../game/labels";
import { knownQuests } from "../../game/selectors";
import { useGame } from "../GameContext";

type Props = {
  /** 없으면 해결 버튼을 숨긴다 (읽기 전용 화면용) */
  onSolve?: (questId: string, solutionId: string) => void;
};

export function QuestPanel({ onSolve }: Props) {
  const { content, state } = useGame();
  const { current, completed } = knownQuests(content, state);

  return (
    <div className="quest-panel">
      <h2>진행 중인 문제</h2>
      {current.length === 0 && <p className="muted">지금은 풀어야 할 문제가 없다.</p>}
      {current.map((q) => (
        <QuestItem key={q.id} quest={q} onSolve={onSolve} />
      ))}

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

function QuestItem({ quest, onSolve }: { quest: Quest; onSolve?: Props["onSolve"] }) {
  const { state, openPerson, isFresh } = useGame();
  const done = state.completedQuests.find((c) => c.questId === quest.id);
  const isNew = !done && isFresh("quests", quest.id);

  return (
    <article className={`quest ${done ? "quest--done" : ""} ${isNew ? "quest--fresh" : ""}`}>
      <header>
        <span className="quest__category">{QUEST_CATEGORY_LABELS[quest.category]}</span>
        <h3>{quest.title}</h3>
        {isNew && <span className="new-tag">NEW</span>}
      </header>
      <p>{quest.description}</p>

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

      <h4>가능한 접근</h4>
      <div className="solutions">
        {quest.solutions.map((s) => {
          const revealed = areConditionsMet(state, s.revealConditions);
          const chosen = done?.solutionId === s.id;
          if (!revealed) {
            return (
              <div key={s.id} className="solution solution--hidden">
                ??? <small>아직 찾지 못한 방법</small>
              </div>
            );
          }
          const ready = s.requirements.every((r) => isConditionMet(state, r.condition));
          return (
            <div key={s.id} className={`solution ${chosen ? "solution--chosen" : ""}`}>
              <div className="solution__title">
                {s.title}
                {chosen && <span className="badge">이 방법으로 해결</span>}
              </div>
              <p className="muted">{s.description}</p>
              <ul className="checklist">
                {s.requirements.map((r, i) => (
                  <li key={i} className={isConditionMet(state, r.condition) ? "ok" : "no"}>
                    {r.label}
                  </li>
                ))}
              </ul>
              {!done && onSolve && (
                <button className="btn" disabled={!ready} onClick={() => onSolve(quest.id, s.id)}>
                  이 방법으로 해결하기
                </button>
              )}
            </div>
          );
        })}
      </div>
    </article>
  );
}
