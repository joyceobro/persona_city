// 동네 지표를 그림 한 장으로 (DESIGN_v2 §8).
// 생계 = 셔터가 올라간 가게 수, 신뢰 = 불 켜진 창, 활기 = 거리의 사람, 극장 = 간판 불빛.

import type { StatId } from "../../types/game";
import { STAT_MAX } from "../../game/rules";

type Props = {
  stats: Record<StatId, number>;
  theaterSaved: boolean;
  /** 결정의 날이 지나 문을 닫았다 (판자). 아니면 불만 꺼져 있다 */
  theaterClosed?: boolean;
  compact?: boolean;
};

const SHOPS = [18, 72, 270, 324];
const WINDOWS = [
  [30, 30],
  [52, 30],
  [84, 30],
  [106, 30],
  [282, 30],
  [304, 30],
  [336, 30],
  [358, 30],
];
/** 사람 자리 (활기가 오를수록 앞에서부터 채운다) */
const PEOPLE = [196, 150, 244, 128, 266, 172, 222, 106, 292, 60, 340, 30, 368, 84];

const share = (value: number, slots: number) => Math.round((Math.min(value, STAT_MAX) / STAT_MAX) * slots * 1.6);

export function TownScene({ stats, theaterSaved, theaterClosed, compact }: Props) {
  const openShops = Math.min(SHOPS.length, share(stats.livelihood, SHOPS.length));
  const litWindows = Math.min(WINDOWS.length, share(stats.trust, WINDOWS.length));
  const people = Math.min(PEOPLE.length, share(stats.vitality, PEOPLE.length));

  return (
    <svg
      className={`town ${compact ? "town--compact" : ""}`}
      viewBox="0 0 400 140"
      role="img"
      aria-label={`해온시 거리. 문 연 가게 ${openShops}곳, 불 켜진 창 ${litWindows}개, 거리의 사람 ${people}명, 극장 ${theaterSaved ? "불 켜짐" : theaterClosed ? "문 닫음" : "불 꺼짐"}`}
    >
      <rect className="town__sky" x="0" y="0" width="400" height="140" />
      <rect className="town__ground" x="0" y="112" width="400" height="28" />

      {/* 양쪽 상가 건물 */}
      {[10, 262].map((x) => (
        <rect key={x} className="town__building" x={x} y="20" width="128" height="92" rx="2" />
      ))}
      {WINDOWS.map(([x, y], i) => (
        <rect
          key={i}
          className={`town__window ${i < litWindows ? "is-lit" : ""}`}
          x={x}
          y={y}
          width="14"
          height="16"
          rx="1"
        />
      ))}
      {SHOPS.map((x, i) => {
        const open = i < openShops;
        return (
          <g key={x} className={`town__shop ${open ? "is-open" : ""}`}>
            <rect className="town__shopfront" x={x} y="70" width="46" height="42" />
            {open ? (
              <>
                <path className="town__awning" d={`M${x - 3} 70 h52 l-5 9 h-42 z`} />
                <rect className="town__shopglow" x={x + 6} y="84" width="34" height="20" rx="1" />
              </>
            ) : (
              Array.from({ length: 6 }, (_, k) => (
                <line key={k} className="town__shutter" x1={x + 2} x2={x + 44} y1={74 + k * 6.5} y2={74 + k * 6.5} />
              ))
            )}
          </g>
        );
      })}

      {/* 가운데 극장 */}
      <g className={`town__theater ${theaterSaved ? "is-lit" : ""}`}>
        <rect className="town__building town__building--theater" x="148" y="8" width="104" height="104" rx="2" />
        <rect className="town__marquee" x="156" y="22" width="88" height="22" rx="2" />
        <text className="town__sign" x="200" y="37.5" textAnchor="middle">
          해온극장
        </text>
        {Array.from({ length: 11 }, (_, k) => (
          <circle key={k} className="town__bulb" cx={160 + k * 8} cy="49" r="1.8" />
        ))}
        <rect className="town__door" x="182" y="76" width="36" height="36" rx="1" />
        {theaterClosed && (
          <>
            <line className="town__plank" x1="178" y1="80" x2="222" y2="106" />
            <line className="town__plank" x1="178" y1="106" x2="222" y2="80" />
          </>
        )}
      </g>

      {/* 거리의 사람들 */}
      {PEOPLE.slice(0, people).map((x, i) => (
        <g key={i} className="town__person" style={{ animationDelay: `${i * 0.08}s` }}>
          <circle cx={x} cy={i % 2 ? 114 : 118} r="3.2" />
          <rect x={x - 3} y={i % 2 ? 117 : 121} width="6" height="9" rx="3" />
        </g>
      ))}
    </svg>
  );
}
