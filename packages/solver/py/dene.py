"""Kullanım: python3 dene.py sablon.json [adet]   (şablon ya da şablon listesi)"""
import json
import random
import sys

from bank import generate


def main():
    if len(sys.argv) < 2:
        sys.exit("Kullanım: python3 dene.py sablon.json [adet]")
    tpls = json.load(open(sys.argv[1], encoding="utf-8"))
    tpls = tpls if isinstance(tpls, list) else [tpls]
    n = int(sys.argv[2]) if len(sys.argv) > 2 else 3
    for t in tpls:
        print(f"== {t.get('id', '?')}")
        rng, seen = random.Random(1), set()
        for _ in range(n):
            try:
                q, rej = generate(t, rng, seen, 200)
            except KeyError as e:
                print("HATA: şablonda eksik alan", e)
                break
            except Exception as e:
                print("HATA:", e)
                break
            if q is None:
                print(f"Soru üretilemedi (elenen: {rej}). Kısıtları ve cevap tanımını kontrol edin.")
                break
            seen.add(q["hash"])
            print(q["govde"]["stem"])
            for i, s in enumerate(q["govde"]["secenekler"]):
                print(f"   {'ABCDE'[i]}) {s}{'  <- doğru' if i == q['cevap']['dogru_index'] else ''}")
            print("   tuzaklar:", "; ".join(f"{x['cevap']}={x['ad']}" for x in q["cevap"]["tuzaklar"]))


if __name__ == "__main__":
    main()
