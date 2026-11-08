"""Özgün soru üretimi: şablon -> parametreler -> SymPy çözümü -> bağımsız kontrol -> şıklar."""
import hashlib
import json
import math
import random
import re

import sympy as sp

from solver import dispatch, safe_parse

_CMP = re.compile(r"^(.*?)(==|!=|>=|<=|>|<)(.*)$")
_HOLE = re.compile(r"\{([a-z])(?::(s|k|sk))?\}")
_OPS = {"==": lambda l, r: l == r, "!=": lambda l, r: l != r, ">=": lambda l, r: l >= r,
        "<=": lambda l, r: l <= r, ">": lambda l, r: l > r, "<": lambda l, r: l < r}
X = sp.Symbol("x")


def _ev(expr, env):
    return safe_parse(expr.strip()).subs({sp.Symbol(k): v for k, v in env.items()})


def _fmt_stem(v, mode):
    n = int(v)
    if mode == "s":   # " + 3" / " - 3"
        return f" + {n}" if n >= 0 else f" - {-n}"
    if mode == "k":   # katsayı: 1 -> "", -1 -> "-"
        return "" if n == 1 else "-" if n == -1 else str(n)
    if mode == "sk":  # işaretli katsayı: " + x" / " - 5"
        return (" + " if n >= 0 else " - ") + ("" if abs(n) == 1 else str(abs(n)))
    return str(n)


def _fill(s, env, math_mode):
    def rep(m):
        k = m.group(1)
        if k not in env:
            raise KeyError(f"Şablonda tanımsız parametre: {k}")
        v = env[k]
        if math_mode:
            return f"({int(v)})" if v < 0 else str(int(v))
        return _fmt_stem(v, m.group(2))
    return _HOLE.sub(rep, s)


def _fill_obj(o, env):
    if isinstance(o, str):
        return _fill(o, env, True)
    if isinstance(o, dict):
        return {k: _fill_obj(v, env) for k, v in o.items()}
    return o


def _ok(constraints, env):
    for c in constraints:
        m = _CMP.match(c)
        if not m:
            raise ValueError(f"Kısıt okunamadı: {c}")
        if not bool(_OPS[m.group(2)](_ev(m.group(1), env), _ev(m.group(3), env))):
            return False
    return True


def _value(c, env, out):
    """Çözücü cevabından şablonun istediği tek sayıyı çıkarır."""
    ans = out.get("answer", "")
    if "turev_noktasi" in c:
        rhs = ans.split("=", 1)[1]
        return sp.simplify(safe_parse(rhs).subs(X, env[c["turev_noktasi"]]))
    pairs = [p.split("=", 1) for p in ans.split("|") if "=" in p]
    vals = [safe_parse(v) for k, v in pairs if k == c.get("anahtar")]
    if not vals:
        return None
    key = lambda t: float(sp.N(t))
    if c.get("secim") == "max":
        return max(vals, key=key)
    if c.get("secim") == "min":
        return min(vals, key=key)
    return vals[0] if len(vals) == 1 else None


def _indep(spec, c, env, value):
    """Çözücüden bağımsız ikinci kontrol (farklı yöntem)."""
    kind = spec["kind"]
    if kind == "equation":
        l, r = spec["eq"].split("=")
        e = safe_parse(l) - safe_parse(r)
        real = sorted((sp.simplify(t) for t in sp.solve(e, X) if t.is_real), key=lambda t: float(sp.N(t)))
        if not real:
            return False
        if c.get("secim") == "max":
            want = real[-1]
        elif c.get("secim") == "min":
            want = real[0]
        else:
            want = real[0] if len(real) == 1 else None
        return want is not None and sp.simplify(want - value) == 0
    if kind == "derivative":
        f = safe_parse(spec["expr"])
        p, h = float(env[c["turev_noktasi"]]), 1e-6
        num = (float(sp.N(f.subs(X, p + h))) - float(sp.N(f.subs(X, p - h)))) / (2 * h)
        v = float(sp.N(value))
        return abs(num - v) < 1e-4 * max(1.0, abs(v))
    if kind == "triangle":  # Heron yerine 1/2·a·b·sin C
        a, b, c3 = (float(safe_parse(str(spec[k]))) for k in ("a", "b", "c"))
        ang = math.acos((a * a + b * b - c3 * c3) / (2 * a * b))
        v = float(sp.N(value))
        return abs(0.5 * a * b * math.sin(ang) - v) < 1e-6 * max(1.0, abs(v))
    return False


def _fmt_val(v):
    v = sp.nsimplify(v, rational=True) if v.is_Float else sp.simplify(v)
    return str(int(v)) if v.is_Integer else sp.sstr(v)


def _options(tpl, env, value, rng):
    correct = _fmt_val(value)
    seen, opts, traps = {correct}, [], []
    for y in tpl.get("yanlislar", []):
        try:
            v = sp.simplify(_ev(y["expr"], env))
        except Exception:
            continue
        if not (v.is_real and v.is_finite):
            continue
        s = _fmt_val(v)
        if s in seen:
            continue
        seen.add(s)
        opts.append(s)
        traps.append({"cevap": s, "ad": y["ad"]})
    d = 1
    while len(opts) < 4 and d < 50:   # tuzak yetmezse doğru cevabın yakınından doldur
        for cand in (value + d, value - d):
            s = _fmt_val(cand)
            if s not in seen and len(opts) < 4:
                seen.add(s)
                opts.append(s)
        d += 1
    opts = opts[:4]
    traps = [t for t in traps if t["cevap"] in opts]
    allopts = opts + [correct]
    rng.shuffle(allopts)
    return allopts, allopts.index(correct), traps


def generate(tpl, rng, exclude=frozenset(), tries=300):
    """(soru | None, elenen_sayısı). None: şablon tükendi ya da hatalı."""
    rejected = 0
    for _ in range(tries):
        env = {k: sp.Integer(rng.randint(lo, hi)) for k, (lo, hi) in tpl["params"].items()}
        bad = False
        for k, e in tpl.get("derived", {}).items():
            v = _ev(e, env)
            if not v.is_Integer:
                bad = True
                break
            env[k] = v
        if bad or not _ok(tpl.get("kisitlar", []), env):
            continue
        spec = _fill_obj(tpl["spec"], env)
        h = hashlib.sha256(json.dumps([tpl["id"], spec], sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:32]
        if h in exclude:
            continue
        try:
            out = json.loads(dispatch(json.dumps(spec)))
            value = _value(tpl["cevap"], env, out) if out.get("ok") else None
            good = value is not None and _indep(spec, tpl["cevap"], env, value)
        except Exception:
            good = False
        if not good:
            rejected += 1
            continue
        options, idx, traps = _options(tpl, env, value, rng)
        z = tpl.get("zorluk", 0.3) + min(0.3, 0.02 * sum(len(str(abs(int(v)))) for v in env.values()))
        return ({
            "sablon_id": tpl["id"], "kazanim_id": tpl["kazanim_id"], "hash": h, "zorluk": round(min(1.0, z), 2),
            "govde": {"stem": _fill(tpl["stem"], env, False), "secenekler": options,
                      "spec": spec, "figure": out.get("figure")},
            "cevap": {"dogru_index": idx, "deger": _fmt_val(value), "tuzaklar": traps},
            "cozum": {"steps": out["steps"], "facts": out["facts"]},
        }, rejected)
    return None, rejected


def generate_batch(templates, n, seed=0, exclude=(), tries=300):
    rng, seen = random.Random(seed), set(exclude)
    live, done, out, rejected, i = list(templates), [], [], 0, 0
    while len(out) < n and live:
        tpl = live[i % len(live)]
        q, rej = generate(tpl, rng, seen, tries)
        rejected += rej
        if q is None:          # şablon tükendi (ya da hatalı): kümeden çıkar
            live.remove(tpl)
            done.append(tpl["id"])
            continue
        seen.add(q["hash"])
        out.append(q)
        i += 1
    return {"sorular": out, "reddedilen": rejected, "tukenen": done}


def to_sql(qs):
    if not qs:
        return ""
    rows = []
    for q in qs:
        js = [json.dumps(q[k], ensure_ascii=False) for k in ("govde", "cevap", "cozum")]
        if any("$j$" in s for s in js):
            raise ValueError("JSON '$j$' içeremez")
        rows.append(f"({q['kazanim_id']}, $j${js[0]}$j$::jsonb, $j${js[1]}$j$::jsonb, "
                    f"$j${js[2]}$j$::jsonb, {q['zorluk']}, true, '{q['hash']}')")
    return ("insert into uretilen_soru (kazanim_id, govde, cevap, cozum, zorluk, dogrulandi, hash) values\n"
            + ",\n".join(rows) + "\non conflict (hash) do nothing;\n")
