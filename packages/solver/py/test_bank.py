import json
import pathlib

import sympy as sp

from bank import _fill, _ok, generate_batch, to_sql
from solver import safe_parse

TPL = json.loads((pathlib.Path(__file__).parent / "sablonlar" / "tyt-temel.json").read_text(encoding="utf-8"))
X = sp.Symbol("x")
I = sp.Integer


def one(tid):
    return [t for t in TPL if t["id"] == tid]


def test_bicim():
    assert _fill("{a:k}x^2{b:sk}x{c:s} = 0", {"a": I(1), "b": I(-1), "c": I(5)}, False) == "x^2 - x + 5 = 0"
    assert _fill("{a}*x+{b}", {"a": I(2), "b": I(-3)}, True) == "2*x+(-3)"


def test_kisit():
    assert not _ok(["a != 0"], {"a": I(0)})
    assert _ok(["a >= 2", "b != a"], {"a": I(2), "b": I(3)})


def test_her_sablon_uretir_ve_tutarli():
    for t in TPL:
        r = generate_batch([t], 6, seed=1)
        assert r["sorular"], t["id"]
        for q in r["sorular"]:
            s = q["govde"]["secenekler"]
            assert len(s) == 5 and len(set(s)) == 5, (t["id"], s)
            assert s[q["cevap"]["dogru_index"]] == q["cevap"]["deger"]
            assert "{" not in q["govde"]["stem"] and q["cozum"]["steps"]


def test_lineer_bagimsiz_dogrulama():
    for q in generate_batch(one("lineer-1"), 10, seed=2)["sorular"]:
        l, r = q["govde"]["spec"]["eq"].split("=")
        sol = sp.solve(safe_parse(l) - safe_parse(r), X)
        assert [str(s) for s in sol] == [q["cevap"]["deger"]]


def test_turev_degeri():
    for q in generate_batch(one("turev-nokta-1"), 8, seed=3)["sorular"]:
        f = safe_parse(q["govde"]["spec"]["expr"])
        assert I(q["cevap"]["deger"]) in [sp.diff(f, X).subs(X, p) for p in range(1, 5)]


def test_tekrar_yok_ve_tohum_belirleyici():
    a = generate_batch(TPL, 20, seed=7)["sorular"]
    b = generate_batch(TPL, 20, seed=7)["sorular"]
    assert [q["hash"] for q in a] == [q["hash"] for q in b]
    assert len({q["hash"] for q in a}) == len(a)
    old = {q["hash"] for q in a}
    assert not ({q["hash"] for q in generate_batch(TPL, 5, seed=7, exclude=old)["sorular"]} & old)


def test_tukenme_ve_hatali_sablon():
    tri = dict(one("ucgen-345")[0], params={"k": [1, 2]})
    r = generate_batch([tri], 10, seed=1, tries=40)
    assert len(r["sorular"]) == 2 and r["tukenen"] == ["ucgen-345"]
    bad = dict(one("lineer-1")[0], cevap={"anahtar": "y"}, id="bozuk")
    r = generate_batch([bad], 3, seed=1, tries=5)
    assert r["sorular"] == [] and r["tukenen"] == ["bozuk"]


def test_sql():
    s = to_sql(generate_batch(TPL, 2, seed=4)["sorular"])
    assert s.count("$j$::jsonb") == 6 and s.rstrip().endswith("on conflict (hash) do nothing;")
    assert to_sql([]) == ""
