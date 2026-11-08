import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { btnP, btn, field } from "../ui";

export function AuthGate({ children }: { children: (s: Session) => ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  if (session === undefined) return <p style={{ padding: 24, fontFamily: "system-ui" }}>Yükleniyor…</p>;
  return session ? <>{children(session)}</> : <AuthForm />;
}

function AuthForm() {
  const [mode, setMode] = useState<"giris" | "kayit">("giris");
  const [f, setF] = useState({ ad: "", yil: "", email: "", sifre: "", veli: "", kvkk: false });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));
  const yil = Number(f.yil);
  const minor = mode === "kayit" && yil > 1900 && new Date().getFullYear() - yil < 19; // SQL tetikleyiciyle aynı kural

  async function submit() {
    setMsg(""); setBusy(true);
    try {
      if (mode === "giris") {
        const { error } = await supabase.auth.signInWithPassword({ email: f.email, password: f.sifre });
        if (error) setMsg("E-posta veya şifre hatalı.");
        return;
      }
      if (!f.ad.trim()) return setMsg("Adını yaz.");
      if (!(yil >= 1950 && yil <= new Date().getFullYear() - 5)) return setMsg("Doğum yılı geçersiz.");
      if (f.sifre.length < 8) return setMsg("Şifre en az 8 karakter olmalı.");
      if (minor && !/^\S+@\S+\.\S+$/.test(f.veli)) return setMsg("18 yaş altı için veli e-postası gerekli.");
      if (!f.kvkk) return setMsg("Devam için aydınlatma metnini onaylamalısın.");
      const { data, error } = await supabase.auth.signUp({
        email: f.email, password: f.sifre,
        options: { data: { ad: f.ad.trim(), dogum_yili: yil, veli_eposta: minor ? f.veli : "", kvkk: "true" } },
      });
      if (error) return setMsg("Kayıt olmadı: " + error.message);
      setMsg((data.session ? "Hesap açıldı. " : "E-postana gelen bağlantıyı onayla, sonra giriş yap. ") +
        (minor ? "18 yaş altı hesaplar veli onayından sonra açılır." : "7 günlük deneme başladı."));
    } finally { setBusy(false); }
  }

  return (
    <div style={{ maxWidth: 380, margin: "0 auto", padding: 20, fontFamily: "system-ui, sans-serif", color: "#1b1f3b" }}>
      <h1 style={{ fontSize: 24 }}>e-dershane</h1>
      <div style={{ display: "grid", gap: 10 }}>
        {mode === "kayit" && <>
          <input style={field} placeholder="Adın" value={f.ad} onChange={(e) => set("ad", e.target.value)} />
          <input style={field} placeholder="Doğum yılın" inputMode="numeric" value={f.yil} onChange={(e) => set("yil", e.target.value)} />
        </>}
        <input style={field} placeholder="E-posta" type="email" autoComplete="email" value={f.email} onChange={(e) => set("email", e.target.value)} />
        <input style={field} placeholder="Şifre" type="password" autoComplete={mode === "giris" ? "current-password" : "new-password"} value={f.sifre} onChange={(e) => set("sifre", e.target.value)} />
        {minor && <input style={field} placeholder="Veli e-postası" type="email" value={f.veli} onChange={(e) => set("veli", e.target.value)} />}
        {mode === "kayit" && <label style={{ fontSize: 13, lineHeight: 1.5 }}>
          <input type="checkbox" checked={f.kvkk} onChange={(e) => set("kvkk", e.target.checked)} />{" "}
          Aydınlatma metnini okudum. Sesim, tarayıcının konuşma tanıma servisine (Chrome’da Google) işlenmek üzere gönderilir; e-dershane ses kaydı saklamaz.
          <br /><i>(Taslak metin: yayından önce hukuki metinle değiştirilecek.)</i>
        </label>}
        <button style={btnP} disabled={busy} onClick={submit}>{mode === "giris" ? "Giriş yap" : "Hesap aç"}</button>
        <button style={btn} onClick={() => { setMode(mode === "giris" ? "kayit" : "giris"); setMsg(""); }}>
          {mode === "giris" ? "Hesabın yok mu? Kayıt ol" : "Zaten hesabım var"}
        </button>
        {msg && <p style={{ margin: 0 }}>{msg}</p>}
      </div>
    </div>
  );
}
