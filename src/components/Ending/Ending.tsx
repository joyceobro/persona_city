// 결말 화면 (DESIGN_v2 §7): 극장의 운명, 지표에 따른 동네의 모습, 함께한 사람들, 놓친 문제.

import type { StatId } from "../../types/game";
import { endingText, peopleById, questsById } from "../../data";
import { STAT_LABELS } from "../../game/labels";
import { STAT_IDS } from "../../game/rules";
import { useGame } from "../GameContext";
import { Portrait } from "../PersonCard/Portrait";
import { TownScene } from "./TownScene";

type Props = { onClose: () => void; onRestart: () => void };

function tierOf(value: number): "high" | "mid" | "low" {
  if (value >= endingText.tiers.high) return "high";
  if (value < endingText.tiers.low) return "low";
  return "mid";
}

export function Ending({ onClose, onRestart }: Props) {
  const { content, state, openPerson } = useGame();
  const main = state.completedQuests.find((c) => c.questId === content.start.mainQuest);
  const theater = endingText.theater[main?.solutionId ?? "failed"] ?? endingText.theater.failed;
  const solved = state.completedQuests.filter((c) => c.questId !== content.start.mainQuest);
  // 기한을 넘긴 문제와, 결정의 날까지 풀지 못한 채 남은 문제
  const missed = [...state.failedQuests, ...state.currentQuestIds.filter((id) => id !== content.start.mainQuest)];
  const closeFriends = state.discoveredPeople.filter((id) => (state.friendships[id]?.level ?? 0) >= 3);

  return (
    <div className="overlay overlay--moment">
      <article className="ending" aria-label="결말">
        <p className="ending__eyebrow">{state.day}일째 · 결정의 날</p>
        <h2>{theater.title}</h2>
        <TownScene stats={state.stats} theaterSaved={!!main} theaterClosed={!main} />
        <p>{theater.text}</p>

        <h3>해온시의 지금</h3>
        <ul className="ending__stats">
          {STAT_IDS.map((id: StatId) => (
            <li key={id} className={`ending__stat ending__stat--${tierOf(state.stats[id])}`}>
              <strong>
                {STAT_LABELS[id]} {state.stats[id]}
              </strong>
              <span>{endingText.stats[id][tierOf(state.stats[id])]}</span>
            </li>
          ))}
        </ul>

        <div className="ending__cols">
          <section>
            <h3>함께 푼 문제 {solved.length}</h3>
            {solved.length === 0 ? (
              <p className="muted">없음</p>
            ) : (
              <ul className="plain">
                {solved.map((c) => {
                  const q = questsById.get(c.questId)!;
                  return (
                    <li key={c.questId}>
                      {q.title} <span className="muted">· {q.solutions.find((s) => s.id === c.solutionId)?.title}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <section>
            <h3>놓친 문제 {missed.length}</h3>
            {missed.length === 0 ? (
              <p className="muted">없음</p>
            ) : (
              <ul className="plain">
                {missed.map((id) => (
                  <li key={id}>
                    {questsById.get(id)?.title}
                    {!state.failedQuests.includes(id) && <span className="muted"> · 풀지 못한 채 남음</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <h3>가까운 친구 {closeFriends.length}</h3>
        {closeFriends.length === 0 ? (
          <p className="muted">아직 가까운 친구는 없다. 다음에는 한 사람과 더 깊이 함께해 보자.</p>
        ) : (
          <div className="ending__friends">
            {closeFriends.map((id) => (
              <button
                key={id}
                className="ending__friend"
                onClick={() => {
                  onClose();
                  openPerson(id);
                }}
              >
                <Portrait person={peopleById.get(id)!} size="md" />
                <span>{peopleById.get(id)!.name}</span>
              </button>
            ))}
          </div>
        )}

        <div className="moment__actions ending__actions">
          <button className="btn" onClick={onRestart}>
            다른 선택으로 다시 하기
          </button>
          <button className="btn btn--ghost" onClick={onClose}>
            동네 둘러보기
          </button>
        </div>
      </article>
    </div>
  );
}
