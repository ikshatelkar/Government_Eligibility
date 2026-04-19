"""
Audit the v4 API: get total scheme count and collect all unique tags
to build an accurate occupation mapping.
"""
import requests, json, time
from collections import Counter

API = "https://api.myscheme.gov.in/search/v4/schemes"
KEY = "tYTy5eEhlu9rFjyxuCr7ra7ACp4dv1RH8gWuHTDc"
HEADERS = {
    "Accept": "application/json",
    "User-Agent": "Mozilla/5.0",
    "Origin": "https://www.myscheme.gov.in",
    "Referer": "https://www.myscheme.gov.in/find-schemes",
    "x-api-key": KEY,
}

all_tags = Counter()
total_schemes = 0
batch = 100
from_idx = 0

print("Scanning all schemes for tags...")
while True:
    r = requests.get(API, headers=HEADERS, params={
        "lang": "en", "q": "[]", "keyword": "",
        "sort": "", "from": str(from_idx), "size": str(batch)
    }, timeout=20)
    data = r.json()
    hits = data.get("data", {}).get("hits", {})
    items = hits.get("items", [])
    if not items:
        break

    for item in items:
        f = item.get("fields", {})
        for tag in (f.get("tags") or []):
            all_tags[str(tag).strip()] += 1

    total = hits.get("total")
    if isinstance(total, dict):
        total = total.get("value", 0)
    total = int(total or 0)

    from_idx += batch
    total_schemes += len(items)
    print(f"  Scanned {total_schemes} / {total} ...")
    if from_idx >= total or total == 0:
        break
    time.sleep(0.3)

print(f"\nTotal schemes in API: {total_schemes}")
print(f"\nTop 80 tags (count | tag):")
for tag, cnt in all_tags.most_common(80):
    print(f"  {cnt:5d}  {tag}")
