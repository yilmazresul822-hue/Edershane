import "@fontsource/caveat/500.css";
import "./paper.css";
import { createRoot } from "react-dom/client";
import { AuthGate } from "./auth/AuthGate";
import { Main } from "./App";
import { QrGate } from "./qr/QrGate";

const q = /^\/s\/([0-9a-f]{32})$/.exec(location.pathname);   // soru QR'ı
const kitap = location.pathname.startsWith("/kitapcik/");     // kapak QR'ı: yanlış defterini açar

createRoot(document.getElementById("root")!).render(
  <AuthGate>
    {(s) => q ? <QrGate session={s} hash={q[1]} /> : <Main session={s} deepLink={kitap ? { notebook: true } : undefined} />}
  </AuthGate>,
);
