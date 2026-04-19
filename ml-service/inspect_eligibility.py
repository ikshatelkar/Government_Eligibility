"""
Inspect the full __NEXT_DATA__ eligibility structure from a real scheme page.
"""
import requests, json
from bs4 import BeautifulSoup

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

# Test with a few different schemes to see eligibility structure
slugs = ["pm-kisan", "pmay-gramin", "national-overseas-scholarship-for-sc", "pmjay"]

for slug in slugs:
    url = f"https://www.myscheme.gov.in/schemes/{slug}"
    r = requests.get(url, headers=HEADERS, timeout=15)
    if r.status_code != 200:
        print(f"{slug}: HTTP {r.status_code}")
        continue
    soup = BeautifulSoup(r.text, "html.parser")
    script = soup.find("script", {"id": "__NEXT_DATA__"})
    if not script:
        print(f"{slug}: no __NEXT_DATA__")
        continue
    data = json.loads(script.string)
    props = data.get("props", {}).get("pageProps", {})
    sd = props.get("schemeData", {}).get("en", {})
    elig = sd.get("eligibilityCriteria", {})
    print(f"\n{'='*60}")
    print(f"SCHEME: {slug}")
    print(f"ELIGIBILITY CRITERIA KEYS: {list(elig.keys())}")
    print(json.dumps(elig, indent=2)[:2000])
