// 정적 콘텐츠 진입점. 게임 코드는 JSON 을 직접 import 하지 않고 여기서 가져간다.
// JSON import 는 문자열 리터럴 타입을 잃으므로 여기서 한 번만 단언한다.
// 참조 무결성 검증은 `npm run validate:data` 가 담당한다 (Phase 7).

import type { GameContent, Location, Person, Quest, Relationship, StartConfig } from "../types/game";
import peopleJson from "./people.json";
import locationsJson from "./locations.json";
import relationshipsJson from "./relationships.json";
import questsJson from "./quests.json";
import startJson from "./start.json";

export const content: GameContent = {
  people: peopleJson as Person[],
  locations: locationsJson as Location[],
  relationships: relationshipsJson as Relationship[],
  quests: questsJson as Quest[],
  start: startJson as StartConfig,
};

export const peopleById = new Map(content.people.map((p) => [p.id, p]));
export const locationsById = new Map(content.locations.map((l) => [l.id, l]));
export const relationshipsById = new Map(content.relationships.map((r) => [r.id, r]));
export const questsById = new Map(content.quests.map((q) => [q.id, q]));
