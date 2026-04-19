"""
Test MyScheme API filter formats to find what works.
"""
import requests
import json

API = "https://api.myscheme.gov.in/search/v4/schemes"
KEY = "tYTy5eEhlu9rFjyxuCr7ra7ACp4dv1RH8gWuHTDc"
HEADERS = {
    "Accept": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Origin": "https://www.myscheme.gov.in",
    "Referer": "https://www.myscheme.gov.in/find-schemes",
    "x-api-key": KEY,
}

def search(filters, label):
    r = requests.get(API, headers=HEADERS, params={
        "lang": "en", "q": json.dumps(filters),
        "keyword": "", "sort": "", "from": "0", "size": "5"
    }, timeout=20)
    data = r.json()
    hits = data.get("data", {}).get("hits", {})
    total = hits.get("total")
    if isinstance(total, dict):
        total = total.get("value", 0)
    items = hits.get("items", [])
    print(f"\n{'='*60}")
    print(f"TEST: {label}")
    print(f"Total results: {total}")
    for item in items[:4]:
        f = item.get("fields", {})
        print(f"  - {f.get('schemeName','?')} | state: {f.get('beneficiaryState','?')}")
    return total, items

# Test 1: No filters (baseline)
search([], "NO FILTERS (baseline)")

# Test 2: Gender filter
search([{"id": "gender", "value": ["Male"]}], "GENDER = Male")

# Test 3: State filter
search([{"id": "state", "value": ["Karnataka"]}], "STATE = Karnataka")

# Test 4: Occupation/target group
search([{"id": "targetBeneficiary", "value": ["Farmer"]}], "targetBeneficiary = Farmer")

# Test 5: Age
search([{"id": "age", "value": "25"}], "AGE = 25")

# Test 6: Combined - farmer, male, age 35, Karnataka
search([
    {"id": "gender", "value": ["Male"]},
    {"id": "state", "value": ["Karnataka"]},
    {"id": "targetBeneficiary", "value": ["Farmer"]},
], "COMBINED: Male + Karnataka + Farmer")

# Test 7: Try different key names
search([{"id": "beneficiaryState", "value": ["Karnataka"]}], "beneficiaryState = Karnataka")

# Test 8: income / maritalStatus / residence
search([{"id": "residence", "value": ["Rural"]}], "residence = Rural")

# Print raw response structure for one call to see all possible filter keys
print("\n\nRAW DATA STRUCTURE (first item):")
r = requests.get(API, headers=HEADERS, params={
    "lang": "en", "q": "[]", "keyword": "", "sort": "", "from": "0", "size": "1"
}, timeout=20)
data = r.json()
items = data.get("data", {}).get("hits", {}).get("items", [])
if items:
    print(json.dumps(items[0].get("fields", {}), indent=2))
