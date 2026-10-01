import { useState, type CSSProperties } from "react";
import type { Person } from "../../types/game";
import { locationsById } from "../../data";
import { portraitUrl } from "../../assets";

type Props = {
  person: Person;
  /** sm/md/lg = 원형 크롭, card = 카드 아트 영역을 가득 채우는 사각형 */
  size?: "sm" | "md" | "lg" | "card";
};

/**
 * 초상화. 배경은 대표 장소 색으로 코드가 깔고, 그림은 투명 배경 상반신을 얹는다 (ART.md).
 * 그림이 없거나 로드에 실패하면 이름 두 글자로 대체한다.
 */
export function Portrait({ person, size = "md" }: Props) {
  const [failed, setFailed] = useState(false);
  const color = locationsById.get(person.locations[0])?.color ?? "#888";
  const url = failed ? undefined : portraitUrl(person);

  return (
    <div className={`portrait portrait--${size}`} style={{ "--accent": color } as CSSProperties}>
      {url ? (
        <img src={url} alt={person.name} onError={() => setFailed(true)} />
      ) : (
        <span className="portrait__initials" aria-hidden>
          {person.name.slice(-2)}
        </span>
      )}
    </div>
  );
}
