"""
re_import_from_api.py
Re-fetches all schemes from the MyScheme v4 API using structured `age` and `tags`
fields to properly set min_age, max_age, gender, disability, and target_occupations
in the DB. This replaces the inaccurate CSV-based data.

Run: python re_import_from_api.py
"""
import requests
import json
import time
import os
import mysql.connector
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'backend', '.env'))

API = "https://api.myscheme.gov.in/search/v4/schemes"
KEY = "tYTy5eEhlu9rFjyxuCr7ra7ACp4dv1RH8gWuHTDc"
HEADERS = {
    "Accept": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Origin": "https://www.myscheme.gov.in",
    "Referer": "https://www.myscheme.gov.in/find-schemes",
    "x-api-key": KEY,
}

CATEGORY_MAP = {
    "Agriculture,Rural & Environment":          "Agriculture",
    "Banking,Financial Services and Insurance": "Financial Inclusion",
    "Business & Entrepreneurship":              "Employment",
    "Education & Learning":                     "Education",
    "Health & Wellness":                        "Health",
    "Housing & Shelter":                        "Housing",
    "Public Safety,Law & Justice":              "Social Welfare",
    "Science, IT & Communications":             "Employment",
    "Skills & Employment":                      "Employment",
    "Social welfare & Empowerment":             "Social Welfare",
    "Sports & Culture":                         "Social Welfare",
    "Transport & Infrastructure":               "Social Welfare",
    "Travel & Tourism":                         "Social Welfare",
    "Utility & Sanitation":                     "Social Welfare",
    "Women and Child":                          "Women & Child",
    "Disability":                               "Disability Support",
}

# ── Tag → occupation mapping ───────────────────────────────────────────────────
# Tags that clearly identify who the scheme targets.
# Multiple matching tags → pick the first match (order matters).
OCCUPATION_TAG_MAP = [
    # Construction / BOCW workers
    (["Construction Worker", "BOCW", "Building Worker", "Construction Labour"],
     "unorganised_worker"),
    # Artisan / craft / handloom
    (["Artisan", "Handicraft", "Handicrafts", "Craftsman", "Handloom", "Weaver",
      "Weavers", "Khadi", "Potter", "Blacksmith"],
     "unorganised_worker"),
    # Auto / transport
    (["Auto Driver", "Rickshaw", "Taxi Driver", "Transport Worker"],
     "unorganised_worker"),
    # Daily wage / migrant / informal
    (["Unorganised Worker", "Daily Wage", "Migrant Worker", "Informal Worker",
      "Street Vendor", "Hawker", "SVANidhi"],
     "unorganised_worker"),
    # Fishermen / aquaculture
    (["Fishermen", "Fisherman", "Fisheries", "Aquaculture", "Fish Farmer"],
     "farmer"),
    # Farmers / agriculture
    (["Farmer", "Farmers", "Kisan", "Agricultural Worker", "Agriculture",
      "Horticulture", "Animal Husbandry", "Dairy", "Sericulture"],
     "farmer"),
    # Students / education
    (["Student", "Students", "Scholar", "Post Matric", "Higher Study",
      "Scholarship", "Fellowship", "Internship", "Trainee", "Apprentice"],
     "student"),
    # Business / MSME / self-employment
    (["MSME", "Entrepreneur", "Entrepreneurship", "Enterprise", "Self-employment",
      "Self Employed", "Business", "Start-up", "Startup", "Mudra"],
     "business"),
    # Ex-serviceman / veterans
    (["Ex-Serviceman", "Ex-Service", "Veteran", "Sainik", "ECHS",
      "Armed Forces", "Defence Personnel"],
     "armed_forces"),
    # Government employees
    (["Government Employee", "Central Government Employee", "Civil Servant",
      "Government Servant", "CGHS"],
     "government_employee"),
]

# Tags that are gender/disability signals (not occupation)
FEMALE_TAGS = {"women", "woman", "girl", "widow", "widowed", "mahila", "female",
               "mother", "pregnant", "maternity", "lactating"}
DISABILITY_TAGS = {"pwd", "disabled", "disability", "divyang", "handicap",
                   "differently abled", "person with disability"}
SENIOR_TAGS = {"senior citizen", "elderly", "old age", "aged"}
CHILD_TAGS = {"child", "children", "juvenile", "orphan", "infant"}


def map_category(raw: str) -> str:
    for key, val in CATEGORY_MAP.items():
        if key.lower() in (raw or "").lower():
            return val
    return "Social Welfare"


def tags_to_occupation(tags: list, category: str) -> str:
    tags_lower = [t.lower().strip() for t in (tags or []) if t]
    tags_set = set(tags_lower)

    # Check occupation signals
    for occ_tags, occ_value in OCCUPATION_TAG_MAP:
        for t in occ_tags:
            if t.lower() in tags_set:
                return occ_value

    # Fall back to category
    if category == "Agriculture":
        return "farmer"
    if category == "Education":
        return "student"

    return "any"


def parse_age_from_api(age_field: dict) -> tuple:
    """Extract the most general (permissive) age range from the API age object."""
    if not age_field or not isinstance(age_field, dict):
        return 0, 120

    min_ages, max_ages = [], []
    for key, bounds in age_field.items():
        if isinstance(bounds, dict):
            gte = bounds.get("gte")
            lte = bounds.get("lte")
            if gte is not None:
                min_ages.append(int(gte))
            if lte is not None:
                max_ages.append(int(lte))

    # Use the most permissive (widest) range across all beneficiary types
    min_age = min(min_ages) if min_ages else 0
    max_age = max(max_ages) if max_ages else 120

    # Sanity-check: ignore implausible values
    if min_age > 100:
        min_age = 0
    if max_age < 5:
        max_age = 120

    return min_age, max_age


def fetch_all_schemes():
    """Paginate through ALL schemes in the API."""
    all_schemes = {}
    from_idx = 0
    batch = 100

    while True:
        try:
            r = requests.get(API, headers=HEADERS, params={
                "lang": "en", "q": "[]", "keyword": "",
                "sort": "", "from": str(from_idx), "size": str(batch)
            }, timeout=20)
            r.raise_for_status()
            data = r.json()
        except Exception as e:
            print(f"  API error at from={from_idx}: {e}")
            break

        items = data.get("data", {}).get("hits", {}).get("items", [])
        if not items:
            break

        for item in items:
            f = item.get("fields", {})
            slug = f.get("slug")
            if slug:
                all_schemes[slug] = f

        from_idx += batch
        print(f"  Fetched {len(all_schemes)} schemes so far...")
        time.sleep(0.2)

    return all_schemes


def main():
    print("Connecting to database...")
    db = mysql.connector.connect(
        host=os.getenv("DB_HOST", "localhost"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME"),
    )
    cursor = db.cursor()

    print("\nFetching all schemes from MyScheme v4 API...")
    api_schemes = fetch_all_schemes()
    print(f"Total from API: {len(api_schemes)}")

    if not api_schemes:
        print("No schemes fetched. Exiting.")
        return

    # Get all slugs in DB
    cursor.execute("SELECT id, external_id FROM programs WHERE external_id IS NOT NULL")
    db_schemes = {row[1]: row[0] for row in cursor.fetchall()}
    print(f"Schemes in DB with external_id: {len(db_schemes)}")

    matched = 0
    updated = 0
    occupation_counts = {}

    for slug, fields in api_schemes.items():
        if slug not in db_schemes:
            continue

        program_id = db_schemes[slug]
        tags = fields.get("tags") or []
        age_field = fields.get("age") or {}
        raw_cats = fields.get("schemeCategory") or []
        raw_cat = raw_cats[0] if raw_cats else ""
        category = map_category(raw_cat)

        # Extract structured age
        min_age, max_age = parse_age_from_api(age_field)

        # Extract occupation from tags + category
        occ = tags_to_occupation(tags, category)

        # Extract gender signal from tags
        tags_lower_set = {t.lower().strip() for t in tags if t}
        gender = "female" if (tags_lower_set & FEMALE_TAGS) else "any"

        # Disability signal
        disability = 1 if (tags_lower_set & DISABILITY_TAGS) else 0

        # Update DB
        cursor.execute("""
            UPDATE programs
            SET min_age = %s,
                max_age = %s,
                gender = %s,
                disability_required = %s,
                target_occupations = %s
            WHERE id = %s
        """, (min_age, max_age, gender, disability, occ, program_id))

        occupation_counts[occ] = occupation_counts.get(occ, 0) + 1
        matched += 1
        if cursor.rowcount > 0:
            updated += 1

    db.commit()
    cursor.close()
    db.close()

    print(f"\nDone!")
    print(f"  Matched: {matched} schemes")
    print(f"  Updated: {updated} rows")
    print(f"\nOccupation distribution:")
    for occ, cnt in sorted(occupation_counts.items(), key=lambda x: -x[1]):
        print(f"  {cnt:5d}  {occ}")


if __name__ == "__main__":
    main()
