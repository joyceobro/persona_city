// 큰 순간의 연출: 새 카드 획득(카드 뒤집기), 퀘스트 완료(도장).
// 여러 개가 한 번에 생기면 대기열로 하나씩 보여 준다.

import { useEffect } from "react";
import type { GameEvent } from "../../types/game";
import { peopleById, questsById } from "../../data";
import { FRIENDSHIP_LABELS, RARITY_STARS } from "../../game/labels";
import { toMessage } from "../DiscoveryToast/DiscoveryToast";
import { useGame } from "../GameContext";
import { Portrait } from "../PersonCard/Portrait";

export type Moment =
  | { kind: "person"; personId: string }
  | { kind: "quest"; questId: string; solutionId: string; results: GameEvent[] };

/** 한 번의 액션에서 나온 이벤트를 연출 대기열로. 퀘스트 완료가 먼저, 새 카드는 그다음. */
export function momentsFrom(events: GameEvent[]): Moment[] {
  const moments: Moment[] = [];
  const done = events.find((e) => e.type === "quest_completed");
  if (done?.type === "quest_completed") {
    moments.push({
      kind: "quest",
      questId: done.questId,
      solutionId: done.solutionId,
      results: events.filter((e) => e !== done && toMessage(e)),
    });
  }
  for (const e of events) if (e.type === "person_discovered") moments.push({ kind: "person", personId: e.personId });
  return moments;
}

export function MomentOverlay({ moment, onClose }: { moment: Moment; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => (e.key === "Escape" || e.key === "Enter") && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="overlay overlay--moment" onClick={onClose}>
      <div className="moment" onClick={(e) => e.stopPropagation()}>
        {moment.kind === "person" ? (
          <CardReveal key={moment.personId} personId={moment.personId} onClose={onClose} />
        ) : (
          <QuestComplete key={moment.questId} moment={moment} onClose={onClose} />
        )}
      </div>
    </div>
  );
}

function CardReveal({ personId, onClose }: { personId: string; onClose: () => void }) {
  const { openPerson } = useGame();
  const person = peopleById.get(personId)!;
  const rarity = person.rarity ?? "common";
  const stars = RARITY_STARS[rarity];

  return (
    <>
      <p className="moment__eyebrow">새로운 사람을 알게 되었습니다</p>
      <div className={`reveal reveal--${rarity}`}>
        <div className="reveal__inner">
          <div className="reveal__face reveal__back" aria-hidden>
            ?
          </div>
          <div className={`reveal__face reveal__front person-card person-card--${rarity}`}>
            <div className="person-card__art">
              <Portrait person={person} size="card" />
            </div>
            <div className="person-card__body">
              <div className="person-card__stars">
                {"★".repeat(stars)}
                <span className="dim">{"★".repeat(3 - stars)}</span>
              </div>
              <div className="person-card__name">{person.name}</div>
              <div className="person-card__occupation">{person.occupation}</div>
              <div className="person-card__meta">
                <span>{FRIENDSHIP_LABELS[0]}</span>
                <span>정보 {person.discoverableInfo.filter((i) => !i.unlock?.length).length}/{person.discoverableInfo.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <p className="moment__caption">도감에 카드가 추가되었다.</p>
      <div className="moment__actions">
        <button
          className="btn btn--ghost"
          onClick={() => {
            onClose();
            openPerson(person.id);
          }}
        >
          카드 보기
        </button>
        <button className="btn" onClick={onClose} autoFocus>
          계속
        </button>
      </div>
    </>
  );
}

function QuestComplete({ moment, onClose }: { moment: Extract<Moment, { kind: "quest" }>; onClose: () => void }) {
  const quest = questsById.get(moment.questId)!;
  const solution = quest.solutions.find((s) => s.id === moment.solutionId);
  const results = moment.results.map(toMessage).filter((m) => m !== null);

  return (
    <div className="quest-done">
      <div className="quest-done__stamp" aria-hidden>
        해결
      </div>
      <h2>{quest.title}</h2>
      {solution && (
        <>
          <p className="quest-done__solution">{solution.title}</p>
          <p className="muted">{solution.description}</p>
        </>
      )}
      {results.length > 0 && (
        <>
          <h3>그 결과</h3>
          <ul className="quest-done__results">
            {results.map((m, i) => (
              <li key={i} style={{ animationDelay: `${0.5 + i * 0.12}s` }}>
                <strong>{m.title}</strong>
                {m.body && <span>{m.body}</span>}
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="moment__actions">
        <button className="btn" onClick={onClose} autoFocus>
          계속
        </button>
      </div>
    </div>
  );
}
