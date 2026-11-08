import type { Script } from "../voice/session";

export type Ctx = {
  question: string; points: string[]; facts: string[];
  steps: { latex: string; note: string }[]; answer?: string; level: 1 | 2 | 3;
};

/** TeacherSession'ın ask parametresi: öğrenci sözünü sunucuya götürür, Script döndürür. */
export function makeAsk(o: { apiUrl: string; getToken: () => Promise<string>; getCtx: () => Ctx }) {
  const history: { role: "student" | "teacher"; text: string }[] = [];
  return async (text?: string): Promise<Script> => {
    const r = await fetch(`${o.apiUrl}/ogretmen/anlat`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${await o.getToken()}` },
      body: JSON.stringify({ ...o.getCtx(), history: history.slice(-10), studentSaid: text?.slice(0, 480) }),
    });
    if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as any).hata ?? `HTTP ${r.status}`);
    const script = ((await r.json()) as { script: Script }).script;
    if (text) history.push({ role: "student", text: text.slice(0, 480) });
    history.push({ role: "teacher", text: script.sentences.map((s) => s.text).join(" ").slice(0, 480) });
    return script;
  };
}
