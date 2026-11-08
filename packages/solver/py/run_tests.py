"""pytest yoksa: python3 run_tests.py  (test_*.py içindeki test_ fonksiyonlarını çalıştırır)"""
import glob, importlib, sys, traceback
sys.path.insert(0, ".")
ok = bad = 0
for f in sorted(glob.glob("test_*.py")):
    m = importlib.import_module(f[:-3])
    for n in sorted(dir(m)):
        if n.startswith("test_"):
            try:
                getattr(m, n)(); ok += 1; print("ok   ", f, n)
            except Exception:
                bad += 1; print("HATA ", f, n); traceback.print_exc()
print(f"\n{ok} geçti, {bad} kaldı")
sys.exit(1 if bad else 0)
