// 그래픽 에셋 해석. 파일명 = 콘텐츠 ID 규칙 (ART.md).
//   src/assets/people/person_001.webp
//   src/assets/locations/loc_cafe.webp
// 빌드 시점에 존재하는 파일만 목록에 잡히므로, 없는 그림을 요청해 404 가 나는 일이 없다.

import type { Location, Person } from "../types/game";

type UrlMap = Record<string, string>;

const portraits: UrlMap = import.meta.glob("./people/*.{webp,png,jpg}", { eager: true, query: "?url", import: "default" });
const locationImages: UrlMap = import.meta.glob("./locations/*.{webp,png,jpg}", { eager: true, query: "?url", import: "default" });

function indexById(files: UrlMap): Map<string, string> {
  return new Map(Object.entries(files).map(([path, url]) => [path.split("/").pop()!.replace(/\.\w+$/, ""), url]));
}

const portraitById = indexById(portraits);
const locationImageById = indexById(locationImages);

export function portraitUrl(person: Person): string | undefined {
  return person.portrait ?? portraitById.get(person.id);
}

export function locationImageUrl(location: Location): string | undefined {
  return location.image ?? locationImageById.get(location.id);
}
