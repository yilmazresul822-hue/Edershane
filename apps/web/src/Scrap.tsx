import type { CSSProperties, ReactNode } from "react";
import { tornPolygon } from "./lib/scrap";

const vars = (o: Record<string, string | number>) => o as CSSProperties;

/** Yırtık kenarlı, beyaz lif paylı, bantlı kâğıt parçası (tıklanabilir). */
export function Scrap({ seed, i = 0, rot = 0, w = 340, h = 110, color, red, tape, tapeRot = -4, onClick, children }: {
  seed: number; i?: number; rot?: number; w?: number; h?: number; color?: string; red?: boolean;
  tape?: boolean; tapeRot?: number; onClick?: () => void; children: ReactNode;
}) {
  return (
    <div className="p-scrap" style={vars({ "--r": `${rot}deg`, "--i": i })}>
      <div className="p-rim" style={{ clipPath: tornPolygon(seed, { w: w + 12, h: h + 12, amp: 5, step: 11 }) }} />
      <button className={"p-body" + (red ? " red" : "")} style={{ clipPath: tornPolygon(seed + 11, { w, h, amp: 3.5, step: 12 }), ...(color ? { backgroundColor: color } : {}) }} onClick={onClick}>
        {children}
      </button>
      {tape && <span className="p-tape" style={vars({ "--tr": `${tapeRot}deg` })} />}
    </div>
  );
}
