export async function embed(key: string, model: string, text: string,
  task: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY"): Promise<number[]> {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      model: `models/${model}`, content: { parts: [{ text: text.slice(0, 4000) }] },
      taskType: task, outputDimensionality: 768,
    }),
  });
  if (!r.ok) throw new Error(`Embedding ${r.status}`);
  const v: unknown = ((await r.json()) as any)?.embedding?.values;
  if (!Array.isArray(v) || v.length !== 768) throw new Error("Embedding boyutu 768 değil");
  const norm = Math.hypot(...(v as number[])) || 1; // kısaltılmış boyutlarda normalizasyon gerekir
  return (v as number[]).map((x) => x / norm);
}
