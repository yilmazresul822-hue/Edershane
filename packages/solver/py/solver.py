"""e-dershane çözücü. Yalnızca yapılandırılmış (JSON) girdi alır; dispatch() tek giriş noktasıdır."""
import json
import math
import re

import sympy as sp
from sympy.parsing.sympy_parser import (
    convert_xor, implicit_multiplication, parse_expr, standard_transformations,
)

FUNCS = {
    "sin": sp.sin, "cos": sp.cos, "tan": sp.tan, "cot": sp.cot,
    "asin": sp.asin, "acos": sp.acos, "atan": sp.atan,
    "sqrt": sp.sqrt, "log": sp.log, "ln": sp.log, "exp": sp.exp,
    "abs": sp.Abs, "pi": sp.pi,
}
VARS = {c: sp.Symbol(c) for c in "abcdfghijklmnopqrstuvwxyz"}  # 'e' yok
GLOBALS = {"Integer": sp.Integer, "Float": sp.Float, "Rational": sp.Rational,
           "Symbol": sp.Symbol, "Function": sp.Function}
TRANSFORMS = standard_transformations + (convert_xor, implicit_multiplication)
CHARS = re.compile(r"^[0-9A-Za-z_+\-*/^().,\s]*$")


def safe_parse(s):
    if not isinstance(s, str) or not s.strip():
        raise ValueError("İfade boş")
    if len(s) > 200 or not CHARS.match(s):
        raise ValueError("İfadede geçersiz karakter var")
    if len(re.findall(r"\^|\*\*", s)) > 4 or re.search(r"\d{7,}", s):
        raise ValueError("İfade çok büyük")
    for name in re.findall(r"[A-Za-z_][A-Za-z0-9_]*", s):
        if name not in FUNCS and not (len(name) == 1 and name in VARS):
            raise ValueError(f"Tanınmayan ifade: {name} (çarpmayı * ile yaz)")
    return parse_expr(s, local_dict={**FUNCS, **VARS}, global_dict=dict(GLOBALS),
                      transformations=TRANSFORMS, evaluate=True)


lat = sp.latex


def _var(v):
    if not isinstance(v, str) or not re.fullmatch(r"[a-df-z]", v):
        raise ValueError("Değişken tek bir küçük harf olmalı")
    return sp.Symbol(v)


def _deriv_matches(F, f, x):
    """d/dx F == f mi? Birkaç noktada sayısal kontrol."""
    tested = 0
    for x0 in (0.7, 1.3, 2.1):
        try:
            h = 1e-5
            num = (complex(sp.N(F.subs(x, x0 + h))) - complex(sp.N(F.subs(x, x0 - h)))) / (2 * h)
            val = complex(sp.N(f.subs(x, x0)))
        except (TypeError, ValueError, ZeroDivisionError):
            continue
        if not (abs(num) < 1e12 and abs(val) < 1e12) or num != num or val != val:
            continue
        tested += 1
        if abs(num - val) > 1e-4 * max(1.0, abs(val)):
            return False
    return tested > 0


def solve_equation(eq, var="x"):
    x = _var(var)
    if not isinstance(eq, str) or eq.count("=") > 1:
        raise ValueError("Denklem tek bir = içermeli")
    l, r = eq.split("=") if "=" in eq else (eq, "0")
    L, R = safe_parse(l), safe_parse(r)
    expr = sp.expand(L - R)
    if not expr.free_symbols <= {x}:
        raise ValueError("Tek bilinmeyenli denklem bekleniyor")
    if x not in expr.free_symbols:
        raise ValueError("Denklem bilinmeyene bağlı değil")
    try:
        p = sp.Poly(expr, x)
    except sp.PolynomialError:
        raise ValueError("Şimdilik yalnızca polinom denklemler destekleniyor")
    deg = p.degree()
    steps = [{"latex": f"{lat(L)} = {lat(R)}", "note": "Verilen denklem"}]
    if deg == 1:
        a, b = p.all_coeffs()
        steps.append({"latex": f"{lat(expr)} = 0", "note": "Her şeyi bir tarafa topla"})
        steps.append({"latex": f"{lat(a * x)} = {lat(-b)}", "note": "Sabit terimi karşıya at"})
        steps.append({"latex": f"{var} = {lat(-b / a)}", "note": "Katsayıya böl"})
    else:
        steps.append({"latex": f"{lat(expr)} = 0", "note": "Her şeyi bir tarafa topla"})
        if deg == 2:
            a, b, c = p.all_coeffs()
            disc = sp.simplify(b**2 - 4 * a * c)
            note = "Diskriminant" + (": negatif, reel kök yok" if disc.is_negative
                                     else ": sıfır, çift kök" if disc == 0 else "")
            steps.append({"latex": rf"\Delta = b^2-4ac = {lat(disc)}", "note": note})
        else:
            steps.append({"latex": f"{lat(sp.factor(expr))} = 0", "note": "Çarpanlara ayır"})
    roots = sorted(set(sp.real_roots(p)), key=lambda t: float(sp.N(t)))
    for t in roots:
        if abs(complex(sp.N(expr.subs(x, t), 30))) > 1e-9:
            raise ValueError("Doğrulama başarısız: kök denklemi sağlamıyor")
        if deg != 1:
            steps.append({"latex": f"{var} = {lat(t)}", "note": "Kök"})
    if roots:
        steps.append({"latex": "", "note": "Kontrol: kökler denklemde yerine konunca sıfır çıktı"})
    else:
        steps.append({"latex": "", "note": "Reel kök yok"})
    return {"steps": steps, "facts": [f"Denklemin derecesi {deg}"],
            "answer": "|".join(f"{var}={sp.sstr(t)}" for t in roots)}


def derivative(expr, var="x"):
    x = _var(var)
    f = safe_parse(expr)
    if not f.free_symbols <= {x}:
        raise ValueError("Tek değişkenli ifade bekleniyor")
    d = sp.simplify(sp.diff(f, x))
    if not _deriv_matches(f, d, x):
        raise ValueError("Türev doğrulanamadı")
    steps = [{"latex": f"f({var}) = {lat(f)}", "note": "Fonksiyon"}]
    terms = sp.Add.make_args(sp.expand(f))
    if len(terms) > 1:
        for t in terms:
            steps.append({"latex": rf"\left({lat(t)}\right)' = {lat(sp.diff(t, x))}", "note": "Terim terim türev"})
    steps.append({"latex": f"f'({var}) = {lat(d)}", "note": "Toplam"})
    return {"steps": steps, "facts": [], "answer": f"f'({var})={sp.sstr(d)}"}


def integral(expr, var="x", a=None, b=None):
    x = _var(var)
    f = safe_parse(expr)
    if not f.free_symbols <= {x}:
        raise ValueError("Tek değişkenli ifade bekleniyor")
    F = sp.integrate(f, x)
    if F.has(sp.Integral):
        raise ValueError("Bu integrali çözemedim")
    if not _deriv_matches(F, f, x):
        raise ValueError("İntegral doğrulanamadı")
    steps = [{"latex": rf"\int {lat(f)}\,d{var}", "note": "İstenen integral"}]
    terms = sp.Add.make_args(sp.expand(f))
    if len(terms) > 1:
        for t in terms:
            steps.append({"latex": rf"\int {lat(t)}\,d{var} = {lat(sp.integrate(t, x))}", "note": "Terim terim integral"})
    if a is None or b is None:
        steps.append({"latex": f"{lat(F)} + C", "note": "Sabit eklemeyi unutma"})
        return {"steps": steps, "facts": [], "answer": f"{sp.sstr(F)}+C"}
    lo, hi = safe_parse(str(a)), safe_parse(str(b))
    val = sp.simplify(F.subs(x, hi) - F.subs(x, lo))
    if not val.is_finite:
        raise ValueError("Genelleştirilmiş integral şimdilik desteklenmiyor")
    num = sp.Integral(f, (x, lo, hi)).evalf()
    if abs(complex(sp.N(val)) - complex(num)) > 1e-6 * max(1.0, abs(complex(num))):
        raise ValueError("Belirli integral doğrulanamadı")
    steps.append({"latex": rf"\left[{lat(F)}\right]_{{{lat(lo)}}}^{{{lat(hi)}}} = {lat(val)}",
                  "note": "Üst sınır eksi alt sınır"})
    return {"steps": steps, "facts": [], "answer": sp.sstr(val)}


def triangle(a, b, c, ask="angles", vertex="B"):
    """Kenarlar: a=BC, b=CA, c=AB. A=(0,0), B=(c,0)."""
    if ask not in ("angles", "area", "altitude") or vertex not in ("A", "B", "C"):
        raise ValueError("ask/vertex geçersiz")
    a, b, c = (safe_parse(str(v)) for v in (a, b, c))
    for v in (a, b, c):
        if v.free_symbols or not (sp.N(v) > 0):
            raise ValueError("Kenarlar pozitif sayı olmalı")
    fa, fb, fc = (float(sp.N(v)) for v in (a, b, c))
    if fa + fb <= fc + 1e-9 or fa + fc <= fb + 1e-9 or fb + fc <= fa + 1e-9:
        raise ValueError("Üçgen eşitsizliği sağlanmıyor")
    cos = {"A": sp.simplify((b**2 + c**2 - a**2) / (2 * b * c)),
           "B": sp.simplify((a**2 + c**2 - b**2) / (2 * a * c)),
           "C": sp.simplify((a**2 + b**2 - c**2) / (2 * a * b))}
    forms = {"A": "b^2+c^2-a^2}{2bc", "B": "a^2+c^2-b^2}{2ac", "C": "a^2+b^2-c^2}{2ab"}
    facts = [f"BC = {sp.sstr(a)}", f"CA = {sp.sstr(b)}", f"AB = {sp.sstr(c)}"]
    steps, ang = [], {}
    for k in "ABC":
        e = sp.simplify(sp.acos(cos[k]) * 180 / sp.pi)
        cv = float(sp.N(cos[k]))
        tur = "dik" if abs(cv) < 1e-9 else ("geniş" if cv < 0 else "dar")
        ang[k] = f"{sp.sstr(e)}°" if e.is_Rational else f"≈{float(sp.N(e)):.1f}°"
        facts.append(f"{k} açısı {ang[k]} ({tur})")
        if ask == "angles":
            steps.append({"latex": rf"\cos {k} = \frac{{{forms[k]}}} = {lat(cos[k])}", "note": "Kosinüs teoremi"})
    s = sp.simplify((a + b + c) / 2)
    area = sp.simplify(sp.sqrt(s * (s - a) * (s - b) * (s - c)))
    if ask in ("area", "altitude"):
        steps.append({"latex": rf"s = \frac{{a+b+c}}{{2}} = {lat(s)}", "note": "Çevrenin yarısı"})
        steps.append({"latex": rf"A = \sqrt{{s(s-a)(s-b)(s-c)}} = {lat(area)}", "note": "Heron formülü"})
    fcA = float(sp.N(cos["A"]))
    P = {"A": (0.0, 0.0), "B": (fc, 0.0), "C": (fb * fcA, fb * math.sqrt(max(0.0, 1 - fcA**2)))}
    if abs(math.dist(P["B"], P["C"]) - fa) > 1e-6 * max(1.0, fa):
        raise ValueError("Şekil tutarsız çıktı")
    if ask == "angles":
        answer = "|".join(f"{k}={ang[k]}" for k in "ABC")
    elif ask == "area":
        answer = f"Alan={sp.sstr(area)}"
    else:
        q1, q2, side = {"A": ("B", "C", a), "B": ("A", "C", b), "C": ("A", "B", c)}[vertex]
        h = sp.simplify(2 * area / side)
        steps.append({"latex": rf"h_{vertex} = \frac{{2A}}{{{lat(side)}}} = {lat(h)}", "note": "Yükseklik = 2·Alan / kenar"})
        (x1, y1), (x2, y2), (px, py) = P[q1], P[q2], P[vertex]
        t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / ((x2 - x1) ** 2 + (y2 - y1) ** 2)
        if t < -1e-9 or t > 1 + 1e-9:
            facts.append(f"{vertex} köşesinden inen dikmenin ayağı {q1}{q2} kenarının dışında")
        answer = f"h={sp.sstr(h)}"
    return {"steps": steps, "facts": facts, "answer": answer,
            "figure": {"points": {k: {"x": v[0], "y": v[1]} for k, v in P.items()},
                       "segments": [["A", "B"], ["B", "C"], ["A", "C"]]}}


KINDS = {"equation": solve_equation, "derivative": derivative,
         "integral": integral, "triangle": triangle}


def dispatch(req_json):
    try:
        req = json.loads(req_json)
        kind = req.get("kind")
        if kind == "ping":
            return json.dumps({"ok": True})
        fn = KINDS.get(kind)
        if fn is None:
            raise ValueError("Bilinmeyen soru türü")
        out = fn(**{k: v for k, v in req.items() if k != "kind"})
        return json.dumps({"ok": True, **out}, ensure_ascii=False)
    except ValueError as e:
        return json.dumps({"ok": False, "error": str(e)}, ensure_ascii=False)
    except Exception:
        return json.dumps({"ok": False, "error": "Çözücü bu girdide hata verdi"}, ensure_ascii=False)
