import type { CSSProperties } from "react";
export const btn: CSSProperties = { font: "inherit", fontWeight: 600, padding: "10px 14px", borderRadius: 8, border: "1px solid #c9c6b8", background: "#fffdf7", color: "#1b1f3b" };
export const btnP: CSSProperties = { ...btn, background: "#2f6fed", borderColor: "#2f6fed", color: "#fff" };
export const row: CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 };
export const card: CSSProperties = {
  position: "fixed", left: 8, right: 8, bottom: "calc(8px + env(safe-area-inset-bottom, 0px))", maxWidth: 520, margin: "0 auto",
  maxHeight: "55vh", overflow: "auto", zIndex: 20, background: "#fffdf7", color: "#1b1f3b", border: "1px solid #c9c6b8",
  borderRadius: 12, padding: 12, fontFamily: "system-ui, sans-serif", fontSize: 15, boxShadow: "0 6px 24px rgba(0,0,0,.18)",
};
export const field: CSSProperties = { font: "inherit", width: "100%", padding: 10, borderRadius: 8, border: "1px solid #c9c6b8", background: "#fff", color: "#1b1f3b", boxSizing: "border-box" };
