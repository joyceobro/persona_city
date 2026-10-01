import { useEffect } from "react";
import type { GameEvent } from "../../types/game";
import { locationsById, peopleById, questsById, relationshipsById } from "../../data";
import { FRIENDSHIP_LABELS, RELATIONSHIP_LABELS, STAT_LABELS, withJosa } from "../../game/labels";
import { useGame } from "../GameContext";

export type Toast = { id: number; event: GameEvent };

type Message = { kind: string; title: string; body?: string; personId?: string };

/** 이벤트 → 알림 문구. 대화와 날짜 변경은 다른 곳에서 보여 주므로 알림을 띄우지 않는다. */
export function toMessage(e: GameEvent): Message | null {
  switch (e.type) {
    case "person_discovered": {
      const p = peopleById.get(e.personId)!;
      return { kind: "person", title: "새로운 사람을 알게 되었습니다", body: `${p.name} · ${p.occupation}`, personId: p.id };
    }
    case "location_discovered":
      return { kind: "location", title: "새로운 장소", body: locationsById.get(e.locationId)?.name };
    case "relationship_discovered": {
      const r = relationshipsById.get(e.relationshipId)!;
      const a = peopleById.get(r.from)!.name;
      const b = peopleById.get(r.to)!.name;
      return { kind: "relation", title: "새로운 관계", body: `${withJosa(a, "와/과")} ${b} — ${RELATIONSHIP_LABELS[r.type]}` };
    }
    case "info_discovered": {
      const p = peopleById.get(e.personId)!;
      return { kind: "info", title: `${p.name}에 대해 알게 된 것`, body: p.discoverableInfo.find((i) => i.id === e.infoId)?.text, personId: p.id };
    }
    case "quest_unlocked":
      return { kind: "quest", title: "새로운 문제", body: questsById.get(e.questId)?.title };
    case "quest_completed": {
      const q = questsById.get(e.questId)!;
      const s = q.solutions.find((x) => x.id === e.solutionId);
      return { kind: "quest", title: `해결: ${q.title}`, body: s?.title };
    }
    case "friendship_level_up": {
      const p = peopleById.get(e.personId)!;
      return { kind: "friend", title: `${p.name} · ${FRIENDSHIP_LABELS[e.level]}`, body: "가까워졌다.", personId: p.id };
    }
    case "friendship_level_down": {
      const p = peopleById.get(e.personId)!;
      return { kind: "drift", title: `${p.name} · ${FRIENDSHIP_LABELS[e.level]}`, body: "한동안 못 봤더니 사이가 멀어졌다.", personId: p.id };
    }
    case "drifting": {
      const p = peopleById.get(e.personId)!;
      return { kind: "drift", title: `${withJosa(p.name, "와/과")} 소원해지고 있다`, body: "며칠째 얼굴을 못 봤다. 내일부터 조금씩 멀어진다.", personId: p.id };
    }
    case "stat_changed":
      return { kind: e.amount > 0 ? "stat-up" : "stat-down", title: `${STAT_LABELS[e.stat]} ${e.amount > 0 ? "+" : ""}${e.amount}` };
    case "quest_worsened": {
      const q = questsById.get(e.questId)!;
      return { kind: "warn", title: `상황이 나빠졌다: ${q.title}`, body: q.worsen?.description };
    }
    case "quest_failed":
      return { kind: "fail", title: "놓친 문제", body: questsById.get(e.questId)?.title };
    case "nothing_found":
      return { kind: "none", title: "새로운 얼굴은 보이지 않는다", body: "누군가와 더 친해지면 달라질지도." };
    case "talk":
    case "day_started":
    case "game_ended":
      return null;
  }
}

const TTL_MS = 5000;

export function DiscoveryToast({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  const { openPerson } = useGame();

  useEffect(() => {
    if (toasts.length === 0) return;
    const oldest = toasts[0];
    const timer = setTimeout(() => onDismiss(oldest.id), TTL_MS);
    return () => clearTimeout(timer);
  }, [toasts, onDismiss]);

  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => {
        const m = toMessage(t.event);
        if (!m) return null;
        return (
          <button
            key={t.id}
            className={`toast toast--${m.kind}`}
            onClick={() => {
              if (m.personId) openPerson(m.personId);
              onDismiss(t.id);
            }}
          >
            <strong>{m.title}</strong>
            {m.body && <span>{m.body}</span>}
          </button>
        );
      })}
    </div>
  );
}
