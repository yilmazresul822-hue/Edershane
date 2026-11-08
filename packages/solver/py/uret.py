"""Kullanım: python3 uret.py sablonlar/tyt-temel.json 40 [tohum] > sorular.sql"""
import json
import sys
import time

from bank import generate_batch, to_sql


def main():
    if len(sys.argv) < 3:
        sys.exit("Kullanım: python3 uret.py sablonlar/dosya.json ADET [tohum]")
    templates = json.load(open(sys.argv[1], encoding="utf-8"))
    seed = int(sys.argv[3]) if len(sys.argv) > 3 else int(time.time())
    r = generate_batch(templates, int(sys.argv[2]), seed)
    print(to_sql(r["sorular"]))
    print(f"-- üretilen: {len(r['sorular'])}, elenen: {r['reddedilen']}, tükenen şablon: {r['tukenen']}", file=sys.stderr)


if __name__ == "__main__":
    main()
