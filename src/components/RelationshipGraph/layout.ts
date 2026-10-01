// 관계 그래프 자동 레이아웃.
// - 각 인물은 첫 번째 장소(노드 색을 정하는 장소)에 끌리고, 다른 장소 쪽으로 조금 치우친다
//   → 그래프가 도시 지도와 비슷한 모양이 된다. 단순 평균이면 여러 곳에 다니는 사람이 엉뚱한 장소 원에 놓인다
// - 관계는 스프링, 노드끼리는 척력
// - 관계선이 남의 노드를 지나가지 않게 하는 일은 노드를 옮기지 않고 선을 휘게 해서 한다 (computeEdgeRoutes)
// - 전체 콘텐츠(20명, 모든 관계) 기준으로 한 번만 계산한다. 발견이 늘어도 노드가 움직이지 않는다.
// - 난수를 쓰지 않아 항상 같은 결과가 나온다.

import type { GameContent } from "../../types/game";

export const GRAPH_W = 1000;
export const GRAPH_H = 720;
const MARGIN_X = 70;
const MARGIN_Y = 60;
/** 여러 장소에 다니는 사람이 첫 장소에서 다른 장소 쪽으로 치우치는 정도 (0 = 첫 장소, 1 = 다른 장소) */
const OTHER_PLACE_PULL = 0.1;

export type Point = { x: number; y: number };

export function toGraphPoint(map: Point): Point {
  return {
    x: MARGIN_X + (map.x / 100) * (GRAPH_W - MARGIN_X * 2),
    y: MARGIN_Y + (map.y / 100) * (GRAPH_H - MARGIN_Y * 2),
  };
}

export function computeLayout(content: GameContent): Map<string, Point> {
  const locationPoint = new Map(content.locations.map((l) => [l.id, toGraphPoint(l.map)]));
  const ids = content.people.map((p) => p.id);
  const index = new Map(ids.map((id, i) => [id, i]));

  const anchors = content.people.map((p) => {
    const [home, ...others] = p.locations.map((l) => locationPoint.get(l)!).filter(Boolean);
    if (!others.length) return { ...home };
    const ox = others.reduce((n, pt) => n + pt.x, 0) / others.length;
    const oy = others.reduce((n, pt) => n + pt.y, 0) / others.length;
    return { x: home.x + (ox - home.x) * OTHER_PLACE_PULL, y: home.y + (oy - home.y) * OTHER_PLACE_PULL };
  });
  // 황금각으로 흩어 놓고 시작 (결정적)
  const pos = anchors.map((a, i) => ({
    x: a.x + Math.cos(i * 2.39996) * 40,
    y: a.y + Math.sin(i * 2.39996) * 40,
  }));
  const edges = content.relationships.map((r) => [index.get(r.from)!, index.get(r.to)!] as const);

  const REPULSION = 22000;
  const SPRING_LENGTH = 110;
  const SPRING_K = 0.003;
  const ANCHOR_K = 0.12;
  const MAX_STEP = 18;

  for (let iter = 0; iter < 400; iter++) {
    const force = pos.map(() => ({ x: 0, y: 0 }));

    for (let i = 0; i < pos.length; i++) {
      for (let j = i + 1; j < pos.length; j++) {
        const dx = pos[i].x - pos[j].x;
        const dy = pos[i].y - pos[j].y;
        const d2 = Math.max(dx * dx + dy * dy, 25);
        const d = Math.sqrt(d2);
        const f = REPULSION / d2;
        force[i].x += (dx / d) * f;
        force[i].y += (dy / d) * f;
        force[j].x -= (dx / d) * f;
        force[j].y -= (dy / d) * f;
      }
    }
    for (const [a, b] of edges) {
      const dx = pos[b].x - pos[a].x;
      const dy = pos[b].y - pos[a].y;
      const d = Math.max(Math.hypot(dx, dy), 1);
      const f = (d - SPRING_LENGTH) * SPRING_K;
      force[a].x += (dx / d) * f;
      force[a].y += (dy / d) * f;
      force[b].x -= (dx / d) * f;
      force[b].y -= (dy / d) * f;
    }
    for (let i = 0; i < pos.length; i++) {
      force[i].x += (anchors[i].x - pos[i].x) * ANCHOR_K;
      force[i].y += (anchors[i].y - pos[i].y) * ANCHOR_K;

      const len = Math.hypot(force[i].x, force[i].y);
      const scale = len > MAX_STEP ? MAX_STEP / len : 1;
      pos[i].x = clamp(pos[i].x + force[i].x * scale, MARGIN_X, GRAPH_W - MARGIN_X);
      pos[i].y = clamp(pos[i].y + force[i].y * scale, MARGIN_Y, GRAPH_H - MARGIN_Y);
    }
  }

  return new Map(ids.map((id, i) => [id, pos[i]]));
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

export type EdgeRoute = {
  /** SVG path d (직선 또는 2차 베지어) */
  d: string;
  /** 곡선의 가운데 점. 관계 이름을 여기에 붙인다 */
  mid: Point;
  /** 선에서 가장 가까운 남의 노드까지 거리 */
  clearance: number;
};

const ROUTE_NODE_CLEARANCE = 36; // 노드 반지름 26 + 여유
const ROUTE_LABEL_CLEARANCE = 18; // 노드 아래 이름 글자
/** 덜 휜 것부터 시도 (0, +20, -20, +40, -40 … ±200) */
const ROUTE_BENDS = [0, ...Array.from({ length: 15 }, (_, i) => [(i + 1) * 20, -(i + 1) * 20]).flat()];

/**
 * 관계선 경로. 직선이 남의 노드(또는 이름)를 지나가면
 * 가운데를 수직으로 밀어낸 곡선 중 가장 덜 휜 것을 고른다. 결정적이다.
 */
export function computeEdgeRoutes(content: GameContent, layout: Map<string, Point>): Map<string, EdgeRoute> {
  const routes = new Map<string, EdgeRoute>();
  const people = content.people.map((p) => ({ id: p.id, pt: layout.get(p.id)! }));

  for (const r of content.relationships) {
    const a = layout.get(r.from)!;
    const b = layout.get(r.to)!;
    const len = Math.max(Math.hypot(b.x - a.x, b.y - a.y), 1);
    const nx = -(b.y - a.y) / len;
    const ny = (b.x - a.x) / len;
    const others = people.filter((p) => p.id !== r.from && p.id !== r.to).map((p) => p.pt);

    let best: EdgeRoute | null = null;
    let bestScore = -Infinity;
    for (const bend of ROUTE_BENDS) {
      // 2차 베지어의 t=0.5 지점이 가운데에서 bend 만큼 떨어지도록 조절점은 2배
      const cx = (a.x + b.x) / 2 + nx * bend * 2;
      const cy = (a.y + b.y) / 2 + ny * bend * 2;
      let score = Infinity; // 필요한 여유 대비 가장 부족한 비율 (1 이상이면 통과)
      let clearance = Infinity;
      for (let i = 1; i < 40; i++) {
        const t = i / 40;
        const u = 1 - t;
        const x = u * u * a.x + 2 * u * t * cx + t * t * b.x;
        const y = u * u * a.y + 2 * u * t * cy + t * t * b.y;
        for (const o of others) {
          const dNode = Math.hypot(x - o.x, y - o.y);
          const dLabel = Math.hypot(x - o.x, y - (o.y + 26 + 12));
          clearance = Math.min(clearance, dNode);
          score = Math.min(score, dNode / ROUTE_NODE_CLEARANCE, dLabel / ROUTE_LABEL_CLEARANCE);
        }
      }
      const route: EdgeRoute = {
        d: bend === 0 ? `M${a.x} ${a.y} L${b.x} ${b.y}` : `M${a.x} ${a.y} Q${cx} ${cy} ${b.x} ${b.y}`,
        mid: { x: (a.x + b.x) / 2 + nx * bend, y: (a.y + b.y) / 2 + ny * bend },
        clearance,
      };
      if (score >= 1) {
        best = route;
        break;
      }
      if (score > bestScore) {
        bestScore = score;
        best = route;
      }
    }
    routes.set(r.id, best!);
  }
  return routes;
}
