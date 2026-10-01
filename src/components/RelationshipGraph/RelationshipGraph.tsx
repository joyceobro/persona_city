import { useMemo, useState } from "react";
import type { Relationship, RelationshipType } from "../../types/game";
import { locationsById, peopleById } from "../../data";
import { portraitUrl } from "../../assets";
import { relationshipLabelFor, RELATIONSHIP_LABELS } from "../../game/labels";
import { DEFAULT_RULES } from "../../game/rules";
import { isDrifting } from "../../game/time";
import { useGame } from "../GameContext";
import { computeEdgeRoutes, computeLayout, GRAPH_H, GRAPH_W, toGraphPoint } from "./layout";

/** 관계 종류를 색 그룹으로 묶는다. 종류가 10개라 색 10개는 읽히지 않는다. */
const EDGE_GROUPS: { id: string; label: string; color: string; types: RelationshipType[]; dashed?: boolean }[] = [
  { id: "close", label: "친구 · 가족", color: "#c2903a", types: ["friend", "old_friend", "hobby_friend", "family"] },
  { id: "guide", label: "멘토 · 제자", color: "#6f9a7a", types: ["mentor", "student"] },
  { id: "work", label: "일 · 동료", color: "#6b7fa8", types: ["business", "coworker"] },
  { id: "near", label: "이웃", color: "#5c9aa0", types: ["neighbor"] },
  { id: "rival", label: "라이벌", color: "#a8566a", types: ["rival"], dashed: true },
];
const groupOf = (t: RelationshipType) => EDGE_GROUPS.find((g) => g.types.includes(t))!;

const NODE_R = 26;

export function RelationshipGraph() {
  const { content, state, openPerson, isFresh } = useGame();
  const layout = useMemo(() => computeLayout(content), [content]);
  const routes = useMemo(() => computeEdgeRoutes(content, layout), [content, layout]);
  const [selected, setSelected] = useState<string | null>(null);

  const people = content.people.filter((p) => state.discoveredPeople.includes(p.id));
  const knownPlaces = content.locations.filter((l) => state.discoveredLocations.includes(l.id));
  const rels = content.relationships.filter((r) => state.discoveredRelationships.includes(r.id));
  const neighbors = useMemo(() => {
    if (!selected) return null;
    const set = new Set([selected]);
    for (const r of rels) {
      if (r.from === selected) set.add(r.to);
      if (r.to === selected) set.add(r.from);
    }
    return set;
  }, [selected, rels]);
  const selectedRels = selected ? rels.filter((r) => r.from === selected || r.to === selected) : [];
  const selectedPerson = selected ? peopleById.get(selected) : undefined;

  return (
    <div className="graph">
      <p className="collection-count">
        알게 된 관계 <strong>{rels.length}</strong> / {content.relationships.length}
        <span className="muted"> · 사람을 누르면 그 사람의 관계만 보인다</span>
      </p>

      <div className="graph__body">
        <svg
          className="graph__svg"
          viewBox={`0 0 ${GRAPH_W} ${GRAPH_H}`}
          role="img"
          aria-label="인물 관계도"
          onClick={() => setSelected(null)}
        >
          <defs>
            <clipPath id="node-clip">
              <circle r={NODE_R - 2} />
            </clipPath>
          </defs>

          {/* 배경: 발견한 장소 영역 */}
          {knownPlaces.map((l) => {
            const pt = toGraphPoint(l.map);
            return <circle key={l.id} className="graph__place" style={{ color: l.color }} cx={pt.x} cy={pt.y} r={90} />;
          })}

          {rels.map((r) => {
            const route = routes.get(r.id)!;
            const g = groupOf(r.type);
            const active = !neighbors || (neighbors.has(r.from) && neighbors.has(r.to) && (r.from === selected || r.to === selected));
            return (
              <g key={r.id} className={`graph__edge ${active ? "" : "is-dim"} ${isFresh("relationships", r.id) ? "is-fresh" : ""}`}>
                <path
                  pathLength={1}
                  d={route.d}
                  fill="none"
                  stroke={g.color}
                  strokeWidth={1 + r.strength * 0.7}
                  strokeDasharray={g.dashed ? "6 5" : undefined}
                />
                {selected && active && (
                  <text x={route.mid.x} y={route.mid.y - 6} textAnchor="middle" className="graph__edge-label">
                    {RELATIONSHIP_LABELS[r.type]}
                  </text>
                )}
                <title>{r.description}</title>
              </g>
            );
          })}

          {people.map((p) => {
            const pt = layout.get(p.id)!;
            const color = locationsById.get(p.locations[0])?.color ?? "#888";
            const url = portraitUrl(p);
            const dim = neighbors && !neighbors.has(p.id);
            const drifting = isDrifting(state, DEFAULT_RULES, p.id);
            const level = state.friendships[p.id]?.level ?? 0;
            return (
              <g
                key={p.id}
                className={`graph__node ${dim ? "is-dim" : ""} ${selected === p.id ? "is-selected" : ""} ${isFresh("people", p.id) ? "is-fresh" : ""} ${drifting ? "is-drifting" : ""}`}
                transform={`translate(${pt.x} ${pt.y})`}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelected(selected === p.id ? null : p.id);
                }}
                role="button"
                aria-label={p.name}
              >
                {/* 나와의 거리: 친구 이상이면 바깥 고리, 소원해지면 점선 */}
                {level >= 2 && <circle className="graph__bond" r={NODE_R + 5} />}
                {level >= 3 && <circle className="graph__bond" r={NODE_R + 9} />}
                <circle r={NODE_R} fill={`color-mix(in srgb, ${color} 18%, #fffdf8)`} stroke={color} />
                {url ? (
                  <image href={url} x={-NODE_R} y={-NODE_R} width={NODE_R * 2} height={NODE_R * 2} clipPath="url(#node-clip)" preserveAspectRatio="xMidYMin slice" />
                ) : (
                  <text textAnchor="middle" dy="0.35em" className="graph__initials" fill={color}>
                    {p.name.slice(-2)}
                  </text>
                )}
                <text y={NODE_R + 16} textAnchor="middle" className="graph__name">
                  {p.name}
                </text>
              </g>
            );
          })}
          {/* 장소 이름은 노드에 가리지 않도록 맨 위 레이어 */}
          {knownPlaces.map((l) => {
            const pt = toGraphPoint(l.map);
            return (
              <text key={l.id} className="graph__place-label" style={{ color: l.color }} x={pt.x} y={pt.y - 96} textAnchor="middle">
                {l.name}
              </text>
            );
          })}
        </svg>

        <aside className="graph__side">
          {selectedPerson ? (
            <>
              <h3>{selectedPerson.name}의 관계</h3>
              <ul className="rel-list">
                {selectedRels.map((r) => (
                  <RelationItem key={r.id} rel={r} viewerId={selectedPerson.id} onPick={setSelected} />
                ))}
              </ul>
              <button className="btn btn--ghost" onClick={() => openPerson(selectedPerson.id)}>
                카드 보기
              </button>
            </>
          ) : (
            <>
              <h3>범례</h3>
              <ul className="legend">
                {EDGE_GROUPS.map((g) => (
                  <li key={g.id}>
                    <svg width="28" height="10" aria-hidden>
                      <line x1="0" y1="5" x2="28" y2="5" stroke={g.color} strokeWidth="3" strokeDasharray={g.dashed ? "5 4" : undefined} />
                    </svg>
                    {g.label}
                  </li>
                ))}
              </ul>
              <p className="muted">선이 굵을수록 깊은 관계다.</p>
              <ul className="legend">
                <li>
                  <svg width="28" height="16" aria-hidden>
                    <circle cx="14" cy="8" r="6" className="legend__bond" />
                  </svg>
                  나와 친구 (고리가 두 겹이면 가까운 친구)
                </li>
                <li>
                  <svg width="28" height="16" aria-hidden>
                    <circle cx="14" cy="8" r="6" className="legend__bond legend__bond--drift" />
                  </svg>
                  오래 못 만나 소원해지는 중
                </li>
              </ul>
              {rels.length === 0 && <p className="muted">사람들과 이야기하다 보면 서로의 관계가 보이기 시작한다.</p>}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

function RelationItem({ rel, viewerId, onPick }: { rel: Relationship; viewerId: string; onPick: (id: string) => void }) {
  const otherId = rel.from === viewerId ? rel.to : rel.from;
  const other = peopleById.get(otherId)!;
  return (
    <li>
      <button className="link" onClick={() => onPick(otherId)}>
        {other.name}
      </button>
      <span className="rel-list__type">{relationshipLabelFor(rel, viewerId)}</span>
      <p className="muted">{rel.description}</p>
    </li>
  );
}
