import { PENS, SIZES, type PenId } from "./pens";
import type { PenChoice } from "./InkLayer";

function Icon({ id, color }: { id: PenId | "tool"; color: string }) {
  const p = { width: 30, height: 30, viewBox: "0 0 30 30", fill: "none", stroke: "#1b1a17", strokeWidth: 1.6, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  switch (id) {
    case "pencil": return <svg {...p}><path d="M5 25 L7 18 L21 4 L26 9 L12 23 Z" fill="#f2c94c" /><path d="M5 25 L7 18 L12 23 Z" fill="#e8d2ae" /><path d="M5 25 L6 21.5 L8.5 24 Z" fill={color} /><path d="M18 7 L23 12" /></svg>;
    case "fountain": return <svg {...p}><path d="M9 6 L21 6 L19 20 L15 26 L11 20 Z" fill={color} /><path d="M15 12 L15 26" /><circle cx="15" cy="12" r="1.6" fill="#fffdf6" /></svg>;
    case "ballpoint": return <svg {...p}><path d="M8 24 L22 5 L25 8 L11 27 Z" fill="#fffdf6" /><path d="M6 27 L8 24 L11 27 Z" fill={color} /><path d="M20 8 L23 11" /></svg>;
    case "marker": return <svg {...p}><path d="M8 14 L22 4 L26 9 L13 19 Z" fill={color} /><path d="M8 14 L13 19 L9 25 L6 22 Z" fill="#fffdf6" /></svg>;
    case "highlighter": return <svg {...p}><path d="M7 15 L19 5 L26 12 L14 22 Z" fill={color} fillOpacity=".8" /><path d="M7 15 L14 22 L8 26 L4 22 Z" fill="#fffdf6" /></svg>;
    default: return <svg {...p}><path d="M8 5 L8 22 L12.5 18 L16 25 L19 23.5 L15.5 17 L21 17 Z" fill="#fffdf6" /></svg>;
  }
}

export function PenTray({ pen, soundOn, onPen, onSound }: {
  pen: PenChoice | null; soundOn: boolean; onPen(p: PenChoice | null): void; onSound(on: boolean): void;
}) {
  const spec = pen ? PENS.find((p) => p.id === pen.id)! : null;
  return (
    <div className="p-tray">
      <button className={!pen ? "on" : ""} onClick={() => onPen(null)} aria-label="Excalidraw araçları" title="Excalidraw araçları (şekil, ok, yazı, seçme)"><Icon id="tool" color="#000" /></button>
      {PENS.map((p) => (
        <button key={p.id} className={pen?.id === p.id ? "on" : ""} aria-label={p.label} title={p.label}
          onClick={() => onPen({ id: p.id, color: pen?.id === p.id ? pen.color : p.colors[0], size: pen?.size ?? 1 })}>
          <Icon id={p.id} color={pen?.id === p.id ? pen.color : p.colors[0]} />
        </button>
      ))}
      <button className={soundOn ? "" : "off"} onClick={() => onSound(!soundOn)} aria-label="Kalem sesi" title="Kalem sesi">{soundOn ? "♪" : "–"}</button>
      {pen && spec && (
        <div className="p-opts">
          <div className="p-opt-title">{spec.label}</div>
          <div className="p-swatches">
            {spec.colors.map((c) => <button key={c} className={c === pen.color ? "on" : ""} style={{ background: c }} aria-label={c} onClick={() => onPen({ ...pen, color: c })} />)}
          </div>
          <div className="p-sizes">
            {SIZES.map((s, i) => <button key={s} className={s === pen.size ? "on" : ""} aria-label={`kalınlık ${i + 1}`} onClick={() => onPen({ ...pen, size: s })}><i style={{ width: 4 + i * 4, height: 4 + i * 4 }} /></button>)}
          </div>
        </div>
      )}
    </div>
  );
}
