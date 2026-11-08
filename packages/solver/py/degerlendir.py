"""Kullanım: python3 degerlendir.py sablonlar/tyt-temel.json [adet]
Şablonlardan N soru üretir; üretim/eleme oranını ve kazanım dağılımını raporlar.
Not: bu bir regresyon ölçümüdür (çözücü ve şablon tutarlılığı); soru kalitesini ölçmez."""
import collections
import json
import sys

from bank import generate_batch


def main():
    if len(sys.argv) < 2:
        sys.exit("Kullanım: python3 degerlendir.py sablonlar/dosya.json [adet]")
    tpls = json.load(open(sys.argv[1], encoding="utf-8"))
    n = int(sys.argv[2]) if len(sys.argv) > 2 else 500
    r = generate_batch(tpls, n, seed=2026)
    qs = r["sorular"]
    toplam = len(qs) + r["reddedilen"]
    print(f"istenen: {n}  üretilen: {len(qs)}  elenen: {r['reddedilen']}  eleme oranı: {r['reddedilen'] / max(1, toplam):.1%}")
    print("tükenen şablon:", r["tukenen"] or "-")
    print("kazanım dağılımı:", dict(sorted(collections.Counter(q["kazanim_id"] for q in qs).items())))
    print("tekrar eden hash:", len(qs) - len({q["hash"] for q in qs}))
    z = [q["zorluk"] for q in qs]
    if z:
        print(f"zorluk: min {min(z)}  ort {sum(z) / len(z):.2f}  maks {max(z)}")


if __name__ == "__main__":
    main()
