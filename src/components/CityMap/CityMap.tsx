import type { CSSProperties } from "react";
import type { GameContent, Quest, SaveData } from "../../types/game";
import { locationImageUrl } from "../../assets";
import { canExploreToday } from "../../game/discovery";
import { STAT_LABELS } from "../../game/labels";
import { deadlineDay, daysLeft } from "../../game/quests";
import { discoveredPeopleAt, knownQuests } from "../../game/selectors";
import { canAct } from "../../game/time";
import { TownScene } from "../Ending/TownScene";
import { useGame } from "../GameContext";
import { PersonCard } from "../PersonCard/PersonCard";

type Props = {
  selectedId: string | null;
  onSelect: (locationId: string) => void;
  /** 없으면 탐험 버튼을 숨긴다 (읽기 전용 화면용) */
  onExplore?: (locationId: string) => void;
};

const HUB = "loc_plaza";

/** 지표 → 장소 분위기 (DESIGN_v2 §8-3) */
function moodOf(value: number): "bright" | "calm" | "dim" {
  if (value >= 50) return "bright";
  if (value < 30) return "dim";
  return "calm";
}

/** 문제가 걸린 장소: 의뢰인이 있는 곳, 없으면 관련 인물 중 아는 사람이 있는 곳 */
function questLocation(content: GameContent, state: SaveData, quest: Quest): string | undefined {
  const ids = [quest.giverId, ...quest.relatedPersonIds].filter(
    (id): id is string => !!id && state.discoveredPeople.includes(id),
  );
  for (const id of ids) {
    const loc = content.people.find((p) => p.id === id)?.locations.find((l) => state.discoveredLocations.includes(l));
    if (loc) return loc;
  }
  return undefined;
}

/** 지도 위 문제 핀: 남은 날을 원으로 보여 준다 */
function QuestPin({ quest }: { quest: Quest }) {
  const { state } = useGame();
  const left = daysLeft(state, quest);
  const due = deadlineDay(state, quest);
  const span = due === undefined ? 1 : due - (state.questUnlockedDay[quest.id] ?? state.day) + 1;
  const frac = left === undefined ? 1 : Math.max(0.04, Math.min(1, (left + 1) / span));
  const urgent = left !== undefined && left <= 1;
  const worsened = state.worsenedQuests.includes(quest.id);
  return (
    <span
      className={`quest-pin ${urgent ? "quest-pin--urgent" : ""} ${worsened ? "quest-pin--worsened" : ""}`}
      title={`${quest.title}${left === undefined ? "" : left <= 0 ? " · 오늘까지" : ` · D-${left}`}`}
    >
      <svg viewBox="0 0 20 20" aria-hidden>
        <circle className="quest-pin__track" cx="10" cy="10" r="8" />
        <circle className="quest-pin__time" cx="10" cy="10" r="8" pathLength={1} strokeDasharray={`${frac} 1`} />
      </svg>
      <b>!</b>
    </span>
  );
}

export function CityMap({ selectedId, onSelect, onExplore }: Props) {
  const { content, state, isFresh } = useGame();
  const hub = content.locations.find((l) => l.id === HUB);
  const selected = content.locations.find((l) => l.id === selectedId && state.discoveredLocations.includes(l.id));
  const questsAt = new Map<string, Quest[]>();
  for (const q of knownQuests(content, state).current) {
    const loc = questLocation(content, state, q);
    if (loc) questsAt.set(loc, [...(questsAt.get(loc) ?? []), q]);
  }
  const mood = (l: (typeof content.locations)[number]) => (l.mood ? moodOf(state.stats[l.mood]) : "calm");

  return (
    <div className="city">
      <div className="city__left">
        <div className="city-map" role="group" aria-label="해온시 지도">
          {hub && (
            <svg className="city-map__roads" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
              {content.locations
                .filter((l) => l.id !== HUB)
                .map((l) => (
                  <line
                    key={`${l.id}-${state.discoveredLocations.includes(l.id)}`}
                    x1={hub.map.x}
                    y1={hub.map.y}
                    x2={l.map.x}
                    y2={l.map.y}
                    pathLength={1}
                    className={[
                      "road",
                      state.discoveredLocations.includes(l.id) ? "" : "road--hidden",
                      isFresh("locations", l.id) ? "road--fresh" : "",
                    ].join(" ")}
                  />
                ))}
            </svg>
          )}
          {content.locations.map((l) => {
            const discovered = state.discoveredLocations.includes(l.id);
            const count = discovered ? discoveredPeopleAt(content, state, l.id).length : 0;
            return (
              <button
                key={l.id}
                className={[
                  "map-spot",
                  discovered ? `map-spot--${mood(l)}` : "map-spot--locked",
                  l.id === selectedId ? "map-spot--selected" : "",
                  isFresh("locations", l.id) ? "map-spot--fresh" : "",
                ].join(" ")}
                style={{ left: `${l.map.x}%`, top: `${l.map.y}%`, "--accent": l.color } as CSSProperties}
                disabled={!discovered}
                onClick={() => onSelect(l.id)}
              >
                <span className="map-spot__name">{discovered ? l.name : "???"}</span>
                {discovered && count > 0 && <span className="map-spot__count">{count}명</span>}
                {discovered && (questsAt.get(l.id)?.length ?? 0) > 0 && (
                  <span className="map-spot__pins">
                    {questsAt.get(l.id)!.map((q) => (
                      <QuestPin key={q.id} quest={q} />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <TownScene
          stats={state.stats}
          theaterSaved={knownQuests(content, state).completed.some((q) => q.id === content.start.mainQuest)}
          theaterClosed={
            state.ended && !knownQuests(content, state).completed.some((q) => q.id === content.start.mainQuest)
          }
          compact
        />
      </div>

      <section className="location-panel">
        {selected ? (
          <>
            {locationImageUrl(selected) && (
              <img className="location-panel__image" src={locationImageUrl(selected)} alt={selected.name} />
            )}
            <header className="location-panel__header" style={{ "--accent": selected.color } as CSSProperties}>
              <h2>{selected.name}</h2>
              {onExplore &&
                (canExploreToday(state, selected.id) ? (
                  <button className="btn" onClick={() => onExplore(selected.id)}>
                    탐험하기 <small className="btn__cost">기운 1</small>
                  </button>
                ) : (
                  <span className="muted">
                    {state.exploredToday.includes(selected.id)
                      ? "오늘은 이미 둘러봤다"
                      : canAct(state)
                        ? ""
                        : "오늘은 기운이 다했다"}
                  </span>
                ))}
            </header>
            <p className="muted">{selected.description}</p>
            {selected.mood && (
              <p className={`location-mood location-mood--${mood(selected)}`}>
                {STAT_LABELS[selected.mood]} {state.stats[selected.mood]} ·{" "}
                {
                  {
                    bright: "불빛이 환하고 사람들 목소리가 들린다.",
                    calm: "평소와 다름없는 하루.",
                    dim: "어딘가 가라앉아 있다.",
                  }[mood(selected)]
                }
              </p>
            )}
            {(questsAt.get(selected.id)?.length ?? 0) > 0 && (
              <p className="location-quests">
                이곳의 문제:{" "}
                {questsAt
                  .get(selected.id)!
                  .map((q) => q.title)
                  .join(", ")}
              </p>
            )}
            <h3>이곳에서 만난 사람</h3>
            <div className="card-grid">
              {discoveredPeopleAt(content, state, selected.id).map((p) => (
                <PersonCard key={p.id} person={p} />
              ))}
            </div>
            {discoveredPeopleAt(content, state, selected.id).length === 0 && (
              <p className="muted">아직 아무도 만나지 못했다.</p>
            )}
          </>
        ) : (
          <p className="muted location-panel__empty">지도에서 장소를 골라 보자.</p>
        )}
      </section>
    </div>
  );
}
