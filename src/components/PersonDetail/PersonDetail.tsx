import { useEffect } from "react";
import { locationsById, peopleById } from "../../data";
import { conditionHint } from "../../game/conditions";
import { FRIENDSHIP_LABELS, relationshipLabelFor } from "../../game/labels";
import { discoveredRelationshipsOf, friendshipLevel, knownInfo, knownQuestsOf } from "../../game/selectors";
import { FRIENDSHIP_THRESHOLDS } from "../../game/rules";
import { canTalkToday } from "../../game/talk";
import { useGame } from "../GameContext";
import { Portrait } from "../PersonCard/Portrait";

type Props = { personId: string; onClose: () => void };

export function PersonDetail({ personId, onClose }: Props) {
  const { content, state, openPerson, dispatch, lastTalk, isFresh } = useGame();
  const person = peopleById.get(personId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!person) return null;

  const { known, locked } = knownInfo(state, person);
  const total = person.discoverableInfo.length;
  const level = friendshipLevel(state, person.id);
  const relationships = discoveredRelationshipsOf(content, state, person.id);
  const quests = knownQuestsOf(content, state, person.id);
  // 목표/고민은 친구(2)가 되어야 보인다. 카드를 얻는 것과 사람을 아는 것은 다르다.
  const showInner = level >= 2;
  const canTalk = canTalkToday(state, person.id);

  return (
    <div className="overlay" onClick={onClose}>
      <article className="person-detail" onClick={(e) => e.stopPropagation()} aria-label={`${person.name} 상세`}>
        <button className="person-detail__close" onClick={onClose} aria-label="닫기">
          ×
        </button>

        <header className="person-detail__header">
          <Portrait person={person} size="lg" />
          <div>
            <h2>{person.name}</h2>
            <p className="muted">
              {person.age}세 · {person.occupation}
            </p>
            <p className="friendship">
              {FRIENDSHIP_LABELS[level]}
              <span className="friendship__pips">
                {[1, 2, 3].map((n) => (
                  <i key={n} className={n <= level ? "on" : ""} />
                ))}
              </span>
              {level < 3 && (
                <small className="muted">
                  다음 단계까지 {FRIENDSHIP_THRESHOLDS[(level + 1) as 1 | 2 | 3] - (state.friendships[person.id]?.experience ?? 0)}
                </small>
              )}
            </p>
          </div>
        </header>

        <section className="talk">
          {lastTalk?.personId === person.id && (
            <p className={`talk__bubble ${lastTalk.isNew ? "" : "talk__bubble--small"}`}>{lastTalk.text}</p>
          )}
          {canTalk ? (
            <button className="btn" onClick={() => dispatch({ type: "talk", personId: person.id })}>
              대화하기
            </button>
          ) : (
            <p className="muted">오늘은 이미 이야기를 나눴다. 내일 다시 찾아가 보자.</p>
          )}
        </section>

        <section>
          <h3>성격</h3>
          <div className="tags">
            {person.traits.map((t) => (
              <span key={t} className="tag">
                {t}
              </span>
            ))}
          </div>
          <h3>관심사</h3>
          <div className="tags">
            {person.interests.map((t) => (
              <span key={t} className="tag tag--soft">
                {t}
              </span>
            ))}
          </div>
        </section>

        <section>
          <h3>
            알고 있는 정보 <span className="muted">{known.length}/{total}</span>
          </h3>
          <div className="progress" aria-hidden>
            <div style={{ width: `${(known.length / total) * 100}%` }} />
          </div>
          <ul className="info-list">
            {known.map((i) => (
              <li key={i.id} className={isFresh("info", i.id) ? "info--fresh" : ""}>
                {isFresh("info", i.id) && <span className="new-tag">새로 알게 됨</span>}
                {i.text}
              </li>
            ))}
            {locked.map((i) => (
              <li key={i.id} className="info-list__locked">
                <span>아직 모르는 이야기</span>
                {i.unlock?.[0] && <small>{conditionHint(content, state, i.unlock[0])}</small>}
              </li>
            ))}
          </ul>
        </section>

        {showInner && (
          <section>
            <h3>바라는 것</h3>
            <p>{person.goal}</p>
            {person.concern && (
              <>
                <h3>고민</h3>
                <p>{person.concern}</p>
              </>
            )}
          </section>
        )}

        <section>
          <h3>관계</h3>
          {relationships.length === 0 ? (
            <p className="muted">아직 알게 된 관계가 없다.</p>
          ) : (
            <ul className="rel-list">
              {relationships.map((r) => {
                const other = peopleById.get(r.from === person.id ? r.to : r.from)!;
                return (
                  <li key={r.id}>
                    <button className="link" onClick={() => openPerson(other.id)}>
                      {other.name}
                    </button>
                    <span className="rel-list__type">{relationshipLabelFor(r, person.id)}</span>
                    {isFresh("relationships", r.id) && <span className="new-tag">NEW</span>}
                    <p className="muted">{r.description}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="person-detail__cols">
          <div>
            <h3>자주 가는 곳</h3>
            <ul className="plain">
              {person.locations.map((id) => (
                <li key={id}>{state.discoveredLocations.includes(id) ? locationsById.get(id)?.name : "???"}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3>관련된 문제</h3>
            {quests.length === 0 ? (
              <p className="muted">없음</p>
            ) : (
              <ul className="plain">
                {quests.map((q) => (
                  <li key={q.id}>{q.title}</li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </article>
    </div>
  );
}
