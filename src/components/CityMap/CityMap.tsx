import type { CSSProperties } from "react";
import { locationImageUrl } from "../../assets";
import { canExploreToday } from "../../game/discovery";
import { discoveredPeopleAt } from "../../game/selectors";
import { useGame } from "../GameContext";
import { PersonCard } from "../PersonCard/PersonCard";

type Props = {
  selectedId: string | null;
  onSelect: (locationId: string) => void;
  /** 없으면 탐험 버튼을 숨긴다 (읽기 전용 화면용) */
  onExplore?: (locationId: string) => void;
};

const HUB = "loc_plaza";

export function CityMap({ selectedId, onSelect, onExplore }: Props) {
  const { content, state, isFresh } = useGame();
  const hub = content.locations.find((l) => l.id === HUB);
  const selected = content.locations.find((l) => l.id === selectedId && state.discoveredLocations.includes(l.id));

  return (
    <div className="city">
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
                discovered ? "" : "map-spot--locked",
                l.id === selectedId ? "map-spot--selected" : "",
                isFresh("locations", l.id) ? "map-spot--fresh" : "",
              ].join(" ")}
              style={{ left: `${l.map.x}%`, top: `${l.map.y}%`, "--accent": l.color } as CSSProperties}
              disabled={!discovered}
              onClick={() => onSelect(l.id)}
            >
              <span className="map-spot__name">{discovered ? l.name : "???"}</span>
              {discovered && count > 0 && <span className="map-spot__count">{count}명</span>}
            </button>
          );
        })}
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
                    탐험하기
                  </button>
                ) : (
                  <span className="muted">오늘은 이미 둘러봤다</span>
                ))}
            </header>
            <p className="muted">{selected.description}</p>
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
