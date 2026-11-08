import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { Main, type DeepLink } from "../App";

export function QrGate({ session, hash }: { session: Session; hash: string }) {
  const [dl, setDl] = useState<DeepLink | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    supabase.from("uretilen_soru").select("govde").eq("hash", hash).maybeSingle().then(({ data, error }) => {
      if (error || !data) return setErr("Bu soru bulunamadı ya da artık yayında değil.");
      setDl({ spec: (data as any).govde.spec, text: (data as any).govde.stem });
    });
  }, [hash]);
  if (err) return <p style={{ padding: 24, fontFamily: "system-ui" }}>{err}</p>;
  if (!dl) return <p style={{ padding: 24, fontFamily: "system-ui" }}>Soru yükleniyor…</p>;
  return <Main session={session} deepLink={dl} />;
}
