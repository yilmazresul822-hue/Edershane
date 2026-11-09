import type { CSSProperties } from "react";
// Kâğıt tasarım dili: etiket şeridi düğmeler, yumuşak gölge, sarı vurgu. (Basma efekti ve animasyonlar paper.css'te.)
const cond = '"Barlow Condensed","Arial Narrow",system-ui,sans-serif';
export const btn: CSSProperties = {
  fontFamily: cond, fontWeight: 700, fontSize: 17, letterSpacing: ".05em", textTransform: "uppercase", padding: "8px 14px 7px",
  borderRadius: 2, border: "1px solid rgba(27,26,23,.55)", background: "#f6f0df", color: "#1b1a17",
  boxShadow: "0 2px 0 rgba(27,26,23,.35), 0 6px 10px rgba(0,0,0,.18)",
};
export const btnP: CSSProperties = { ...btn, background: "#f7e04b", border: "1px solid rgba(27,26,23,.7)" };
export const row: CSSProperties = { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 };
export const card: CSSProperties = {
  position: "fixed", left: 10, right: 10, bottom: "calc(10px + env(safe-area-inset-bottom, 0px))", maxWidth: 520, margin: "0 auto",
  maxHeight: "58vh", overflow: "auto", zIndex: 20, background: "#f6f0df", color: "#1b1a17", border: "1px solid rgba(27,26,23,.35)",
  borderRadius: 3, padding: 16, fontSize: 16, fontFamily: '"Barlow",system-ui,sans-serif',
  boxShadow: "0 0 0 5px #fffdf6, 0 14px 26px rgba(0,0,0,.38)", animation: "paperIn .55s cubic-bezier(.34,1.3,.64,1) both",
};
export const field: CSSProperties = { fontSize: 16, width: "100%", padding: 10, borderRadius: 2, border: "1px solid rgba(27,26,23,.55)", background: "#fffdf6", color: "#1b1a17", boxSizing: "border-box" };
