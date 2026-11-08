import json
import sympy as sp
from solver import dispatch, safe_parse

def run(**r):
    return json.loads(dispatch(json.dumps(r)))

def test_dogrusal():
    r = run(kind="equation", eq="2*x+3=7")
    assert r["ok"] and r["answer"] == "x=2"

def test_ikinci_derece():
    assert run(kind="equation", eq="x^2-5x+6=0")["answer"] == "x=2|x=3"

def test_reel_kok_yok():
    r = run(kind="equation", eq="x^2+1=0")
    assert r["ok"] and r["answer"] == ""

def test_turev():
    r = run(kind="derivative", expr="x^3+2x")
    rhs = r["answer"].split("=", 1)[1]
    assert sp.simplify(safe_parse(rhs) - (3 * sp.Symbol("x") ** 2 + 2)) == 0

def test_integral():
    assert run(kind="integral", expr="2x", a="0", b="1")["answer"] == "1"
    assert run(kind="integral", expr="2x")["answer"] == "x**2+C"

def test_ucgen_3_4_5():
    r = run(kind="triangle", a=3, b=4, c=5, ask="area")
    assert r["answer"] == "Alan=6"
    assert any("90" in f for f in r["facts"])

def test_genis_acili_dikme_disarida():
    r = run(kind="triangle", a=7, b=3, c=5, ask="altitude", vertex="B")
    assert any("120" in f for f in r["facts"])
    assert any("dışında" in f for f in r["facts"])
    assert r["answer"] == "h=5*sqrt(3)/2"

def test_reddedilenler():
    assert not run(kind="equation", eq="__import__('os').system('ls')")["ok"]
    assert not run(kind="equation", eq="9^9^9^9^9^9=1")["ok"]
    assert not run(kind="equation", eq="sin(x)=0")["ok"]
    assert not run(kind="triangle", a=1, b=2, c=3)["ok"]
    assert not run(kind="bilinmeyen")["ok"]
