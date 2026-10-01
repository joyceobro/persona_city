import type { Person } from "../../types/game";
import { FRIENDSHIP_LABELS, RARITY_STARS } from "../../game/labels";
import { friendshipLevel, knownInfo } from "../../game/selectors";
import { DEFAULT_RULES } from "../../game/rules";
import { isDrifting } from "../../game/time";
import { useGame } from "../GameContext";
import { Portrait } from "./Portrait";

/**
 * 5:7 수집 카드. 레이어: [장소 색 배경 + 초상화] → [희귀도 프레임] → [텍스트].
 * 프레임은 CSS 의 person-card--{rarity} 가 담당한다.
 */
export function PersonCard({ person }: { person: Person }) {
  const { state, openPerson, isFresh } = useGame();
  const { known } = knownInfo(state, person);
  const total = person.discoverableInfo.length;
  const rarity = person.rarity ?? "common";
  const stars = RARITY_STARS[rarity];

  return (
    <button className={`person-card person-card--${rarity}`} onClick={() => openPerson(person.id)}>
      {isFresh("people", person.id) && <span className="new-ribbon">NEW</span>}
      {isDrifting(state, DEFAULT_RULES, person.id) && (
        <span className="drift-ribbon" title="오래 못 만나 소원해지는 중">
          소원
        </span>
      )}
      <div className="person-card__art">
        <Portrait person={person} size="card" />
      </div>
      <div className="person-card__body">
        <div className="person-card__stars" aria-label={`희귀도 ${stars}`}>
          {"★".repeat(stars)}
          <span className="dim">{"★".repeat(3 - stars)}</span>
        </div>
        <div className="person-card__name">{person.name}</div>
        <div className="person-card__occupation">{person.occupation}</div>
        <div className="person-card__meta">
          <span>{FRIENDSHIP_LABELS[friendshipLevel(state, person.id)]}</span>
          <span>
            정보 {known.length}/{total}
          </span>
        </div>
      </div>
    </button>
  );
}

/** 도감의 빈 칸 = 카드 뒷면 */
export function LockedPersonCard() {
  return (
    <div className="person-card person-card--locked" aria-label="아직 만나지 못한 사람">
      <div className="person-card__art">
        <span className="person-card__back">?</span>
      </div>
      <div className="person-card__body">
        <div className="person-card__name">???</div>
        <div className="person-card__occupation">아직 만나지 못한 사람</div>
      </div>
    </div>
  );
}
