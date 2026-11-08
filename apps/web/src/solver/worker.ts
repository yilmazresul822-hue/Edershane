import solverPy from "../../../../packages/solver/py/solver.py?raw";

const PYODIDE = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/"; // sürümü ilk çalıştırmada doğrulayın
let ready: Promise<any> | null = null;

function init() {
  ready ??= (async () => {
    const { loadPyodide } = await import(/* @vite-ignore */ PYODIDE + "pyodide.mjs");
    const py = await loadPyodide({ indexURL: PYODIDE });
    await py.loadPackage("sympy");
    py.runPython(solverPy);
    return py;
  })().catch((e) => { ready = null; throw e; });
  return ready;
}

self.onmessage = async (e: MessageEvent) => {
  const { id, req } = e.data;
  try {
    const py = await init();
    const out: string = py.globals.get("dispatch")(JSON.stringify(req));
    (self as any).postMessage({ id, res: JSON.parse(out) });
  } catch (err) {
    (self as any).postMessage({ id, error: String(err) });
  }
};
