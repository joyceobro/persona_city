import { useState } from "react";
import type { LogEntry } from "../../types/game";
import { discoveredPeopleAt } from "../../game/selectors";
import { toMessage } from "../DiscoveryToast/DiscoveryToast";
import { useGame } from "../GameContext";
import { LockedPersonCard, PersonCard } from "../PersonCard/PersonCard";

type Tab = "log" | "places";

/** 도시 백과사전. 사람/관계/문제는 각각 상단 탭이 맡고, 여기는 발견 기록과 장소. */
export function Journal() {
  const [tab, setTab] = useState<Tab>("log");
  return (
    <div className="journal">
      <div className="subtabs" role="tablist">
        <button role="tab" aria-selected={tab === "log"} onClick={() => setTab("log")}>
          발견 기록
        </button>
        <button role="tab" aria-selected={tab === "places"} onClick={() => setTab("places")}>
          장소
        </button>
      </div>
      {tab === "log" ? <DiscoveryLog /> : <Places />}
    </div>
  );
}

function DiscoveryLog() {
  const { state, openPerson } = useGame();
  if (state.log.length === 0) {
    return <p className="muted">아직 기록이 없다. 사람을 만나고 이야기를 나누면 이곳에 하나씩 쌓인다.</p>;
  }

  const byDay = new Map<number, LogEntry[]>();
  for (const entry of state.log) byDay.set(entry.day, [...(byDay.get(entry.day) ?? []), entry]);
  const days = [...byDay.keys()].sort((a, b) => b - a);

  return (
    <div className="log">
      {days.map((day) => (
        <section key={day} className="log__day">
          <h3>{day}일째</h3>
          <ul>
            {byDay.get(day)!.map((entry, i) => {
              const m = toMessage(entry.event);
              if (!m) return null;
              return (
                <li key={i} className={`log__item log__item--${m.kind}`}>
                  <strong>{m.title}</strong>
                  {m.body &&
                    (m.personId ? (
                      <button className="link log__body" onClick={() => openPerson(m.personId!)}>
                        {m.body}
                      </button>
                    ) : (
                      <span className="log__body">{m.body}</span>
                    ))}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Places() {
  const { content, state } = useGame();
  return (
    <ul className="place-list">
      {content.locations.map((l) => {
        const known = state.discoveredLocations.includes(l.id);
        const met = known ? discoveredPeopleAt(content, state, l.id).length : 0;
        const total = content.people.filter((p) => p.locations.includes(l.id)).length;
        return (
          <li key={l.id} className={known ? "" : "locked"}>
            <strong>{known ? l.name : "???"}</strong>
            {known && (
              <>
                <span className="muted"> · 만난 사람 {met}/{total}</span>
                <p className="muted">{l.description}</p>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** 사람 카드 도감. 만나지 못한 칸은 비워 둔다. */
export function PeopleCollection() {
  const { content, state } = useGame();
  return (
    <div>
      <p className="collection-count">
        도감 <strong>{state.discoveredPeople.length}</strong> / {content.people.length}
      </p>
      <div className="card-grid">
        {content.people.map((p) =>
          state.discoveredPeople.includes(p.id) ? <PersonCard key={p.id} person={p} /> : <LockedPersonCard key={p.id} />,
        )}
      </div>
    </div>
  );
}
