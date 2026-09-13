import json
import time
from pathlib import Path

import requests


API_URL = "https://ssd-api.jpl.nasa.gov/sbdb_query.api"

OUTPUT_FILE = Path(__file__).resolve().parent.parent / "data" / "sbdb_asteroids.json"


FIELDS = [
    "spkid",
    "full_name",
    "pdes",
    "name",
    "kind",
    "class",
    "neo",
    "pha",
    "moid",
    "moid_ld",
    "e",
    "a",
    "q",
    "i",
    "om",
    "w",
    "ma",
    "per",
    "ad",
    "H",
    "diameter",
    "albedo",
    "rot_per",
    "condition_code",
    "data_arc",
    "first_obs",
    "last_obs",
    "n_obs_used",
    "soln_date",
]


def fetch_page(limit_from: int, limit: int = 1000):
    params = {
        "fields": ",".join(FIELDS),

        # Sadece asteroidler
        "sb-kind": "a",

        # Sadece NEO'lar
        "sb-group": "neo",

        "limit": limit,
        "limit-from": limit_from,

        # Tam hassasiyet
        "full-prec": "1",

        # İsme göre sırala
        "sort": "spkid",
    }

    response = requests.get(
        API_URL,
        params=params,
        timeout=60,
    )

    response.raise_for_status()

    return response.json()


def main():
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    print("SBDB verileri indiriliyor...")

    all_data = []
    offset = 0
    page_size = 1000

    while True:
        print(f"İndiriliyor: {offset} - {offset + page_size}")

        data = fetch_page(offset, page_size)

        if "error" in data:
            raise RuntimeError(data["error"])

        records = data.get("data", [])

        if not records:
            break

        all_data.extend(records)

        # Daha fazla veri var mı?
        if len(records) < page_size:
            break

        offset += page_size

        # API'yi gereksiz yere zorlamamak için
        time.sleep(0.2)

    result = {
        "source": "NASA/JPL Small-Body Database",
        "api": API_URL,
        "fields": FIELDS,
        "count": len(all_data),
        "data": all_data,
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(
            result,
            f,
            ensure_ascii=False,
            indent=2,
        )

    print()
    print("✓ İndirme tamamlandı")
    print(f"✓ Toplam kayıt: {len(all_data)}")
    print(f"✓ Dosya: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
    