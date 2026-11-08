import { fitToBounds } from "@edershane/geometry-core";
import type { SceneInit } from "@edershane/board-player";
import type { Figure } from "./client";

/** o: sahnede boş alanın sol üst köşesi (PDF'in sağı). Şekil yoksa çözüm sütunu tüm alanı kullanır. */
export function sceneFromFigure(f: Figure | undefined, o: { x: number; y: number }, view = { w: 1000, h: 700 }): SceneInit {
  return {
    points: f ? fitToBounds(f.points, { x: o.x, y: o.y, w: 640, h: view.h }, 70) : {},
    segments: f?.segments ?? [],
    bounds: { x: o.x, y: o.y, ...view },
    toScale: true, // şekli çözücü ürettiği için ölçeklidir
    column: f ? { x: o.x + 680, y: o.y + 80, w: 300, h: 520 } : { x: o.x + 20, y: o.y + 40, w: 960, h: 600 },
  };
}
