"""
Check if the v4 API returns full eligibility data fields per scheme.
"""
import requests, json

API = "https://api.myscheme.gov.in/search/v4/schemes"
KEY = "tYTy5eEhlu9rFjyxuCr7ra7ACp4dv1RH8gWuHTDc"
HEADERS = {
    "Accept": "application/json",
    "User-Agent": "Mozilla/5.0",
    "Origin": "https://www.myscheme.gov.in",
    "Referer": "https://www.myscheme.gov.in/find-schemes",
    "x-api-key": KEY,
}

# Fetch 3 schemes and print ALL their fields
r = requests.get(API, headers=HEADERS, params={
    "lang": "en", "q": "[]", "keyword": "farmer",
    "sort": "", "from": "0", "size": "3"
}, timeout=20)
data = r.json()
items = data.get("data", {}).get("hits", {}).get("items", [])
for item in items:
    f = item.get("fields", {})
    print(f"\n{'='*60}")
    print(f"SCHEME: {f.get('schemeName')}")
    print("ALL FIELDS:")
    print(json.dumps(f, indent=2))
