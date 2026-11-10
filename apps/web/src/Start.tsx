import { useRef, useState } from "react";
import { Scrap } from "./Scrap";
import { btn } from "./ui";

type Props = {
  ad: string;
  onPdf(file: File): void;
  onNotebook(kind: "sayfali" | "sonsuz"): void;
  onWrongBook(): void;
  onReport(): void;
  onAdmin?: () => void;
  onSignOut(): void;
};

export function Start({ ad, onPdf, onNotebook, onWrongBook, onReport, onAdmin, onSignOut }: Props) {
  const fileIn = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"main" | "defter">("main");
  const [note, setNote] = useState("");

  return (
    <main className="p-start">
      <div className="p-deco" aria-hidden="true">
        <div className="p-patch" /><div className="p-dot"><i /></div><div className="p-tri"><i /></div><div className="p-zig"><i /></div>
      </div>
      <span className="p-label">YKS · LGS · Matematik ve Geometri</span>
      <h1 className="p-title">
        e-<span className="p-circled">dershane
          <svg className="p-circle" viewBox="0 0 220 70" preserveAspectRatio="none" aria-hidden="true">
            <path pathLength="100" d="M18 36 C10 10 120 2 180 12 C226 20 214 56 130 62 C52 67 2 54 12 26 C16 14 40 8 60 6" />
          </svg>
        </span>
      </h1>
      <p className="p-sub">{ad ? `Merhaba ${ad}, ` : ""}{step === "main" ? "neyle başlayalım?" : "nasıl bir defter olsun?"}</p>
      {note && <div className="p-note">{note}</div>}

      {step === "main" && <>
        <Scrap seed={3} i={0} rot={-1.8} tape tapeRot={-5} onClick={() => fileIn.current?.click()}>
          <span className="p-stamp">PDF</span>
          <b>PDF aktar</b><span className="sub">Kitabını ya da denemeni deftere çevir</span>
        </Scrap>
        <Scrap seed={19} i={1} rot={1.5} red tape tapeRot={5} onClick={() => setStep("defter")}>
          <b>Defter oluştur</b><span className="sub">Sayfalı defter ya da sonsuz tuval</span>
        </Scrap>
        <Scrap seed={41} i={2} rot={-1} color="#d8c79f" onClick={() => setNote("Koçluk görüşmesi ve yıllık program yakında. Önce defteri ve öğretmeni sağlamlaştırıyoruz.")}>
          <b>Koçluk görüşmesi</b><span className="sub">Yıllık programını birlikte kuralım</span>
          <span className="p-label" style={{ position: "absolute", right: 14, bottom: 12 }}>yakında</span>
        </Scrap>
      </>}

      {step === "defter" && <>
        <Scrap seed={5} i={0} rot={-1.2} tape onClick={() => onNotebook("sayfali")}>
          <b>Sayfalı defter</b><span className="sub">Çizgili A4 sayfalar, spiralli, sayfa çevirerek</span>
        </Scrap>
        <Scrap seed={27} i={1} rot={1.1} color="#e9dcae" tape tapeRot={6} onClick={() => onNotebook("sonsuz")}>
          <b>Sonsuz tuval</b><span className="sub">Sınırsız boş alan, istediğin yere yaz</span>
        </Scrap>
        <button style={btn} onClick={() => setStep("main")}>‹ Geri</button>
      </>}

      <div className="p-mini" style={{ marginTop: 24 }}>
        <button style={btn} onClick={onWrongBook}>Yanlış defterim</button>
        <button style={btn} onClick={onReport}>Rapor</button>
        {onAdmin && <button style={btn} onClick={onAdmin}>Yönetici</button>}
        <button style={btn} onClick={onSignOut}>Çıkış</button>
      </div>

      <input ref={fileIn} type="file" accept="application/pdf,image/*" hidden
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onPdf(f); }} />
    </main>
  );
}
