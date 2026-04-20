"""
re_import_from_api.py  (v2)
Re-fetches all schemes from the MyScheme v4 API.
Populates: min_age, max_age, gender, disability_required, target_occupations,
           location_type, ministry, how_to_apply, benefits, tags_list, education_min
"""
import requests
import json
import time
import os
import mysql.connector
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'backend', '.env'))

API    = "https://api.myscheme.gov.in/search/v4/schemes"
DETAIL = "https://api.myscheme.gov.in/search/v4/schemes/{slug}"
KEY    = "tYTy5eEhlu9rFjyxuCr7ra7ACp4dv1RH8gWuHTDc"
HEADERS = {
    "Accept": "application/json",
    "User-Agent": "Mozilla/5.0",
    "Origin": "https://www.myscheme.gov.in",
    "Referer": "https://www.myscheme.gov.in/find-schemes",
    "x-api-key": KEY,
}

# ── Category map ───────────────────────────────────────────────────────────────
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

# ── Occupation tag map ────────────────────────────────────────────────────────
OCCUPATION_TAG_MAP = [
    (["Construction Worker","BOCW","Building Worker","Construction Labour"], "unorganised_worker"),
    (["Artisan","Handicraft","Handicrafts","Craftsman","Handloom","Weaver",
      "Weavers","Khadi","Potter","Blacksmith"], "unorganised_worker"),
    (["Auto Driver","Rickshaw","Taxi Driver","Transport Worker"], "unorganised_worker"),
    (["Unorganised Worker","Daily Wage","Migrant Worker","Informal Worker",
      "Street Vendor","Hawker","SVANidhi"], "unorganised_worker"),
    (["Fishermen","Fisherman","Fisheries","Aquaculture","Fish Farmer"], "farmer"),
    (["Farmer","Farmers","Kisan","Agricultural Worker","Agriculture",
      "Horticulture","Animal Husbandry","Dairy","Sericulture"], "farmer"),
    (["Student","Students","Scholar","Post Matric","Higher Study",
      "Scholarship","Fellowship","Trainee","Apprentice"], "student"),
    (["MSME","Entrepreneur","Entrepreneurship","Enterprise","Self-employment",
      "Self Employed","Business","Start-up","Startup","Mudra"], "business"),
    (["Ex-Serviceman","Ex-Service","Veteran","Sainik","ECHS",
      "Armed Forces","Defence Personnel"], "armed_forces"),
    (["Government Employee","Central Government Employee","Civil Servant",
      "Government Servant","CGHS"], "government_employee"),
]

FEMALE_TAGS     = {"women","woman","girl","widow","widowed","mahila","female",
                   "mother","pregnant","maternity","lactating"}
DISABILITY_TAGS = {"pwd","disabled","disability","divyang","handicap",
                   "differently abled","person with disability"}
RURAL_TAGS      = {"rural","village","gram","panchayat","gramin","kisan"}
URBAN_TAGS      = {"urban","city","municipal","metro","town"}

# Education min detection from tags
EDU_TAGS = {
    "doctoral": "Post-Graduate",
    "phd": "Post-Graduate",
    "post-graduate": "Post-Graduate",
    "postgraduate": "Post-Graduate",
    "graduate": "Graduate",
    "graduation": "Graduate",
    "degree": "Graduate",
    "undergraduate": "Graduate",
    "higher secondary": "Higher Secondary",
    "12th": "Higher Secondary",
    "class xii": "Higher Secondary",
    "post-matric": "Higher Secondary",
    "postmatric": "Higher Secondary",
    "secondary": "Secondary",
    "10th": "Secondary",
    "class x": "Secondary",
    "matric": "Secondary",
    "8th": "Primary",
    "primary": "Primary",
    "5th": "Primary",
    "illiterate": "Illiterate",
}


def map_category(raw):
    for key, val in CATEGORY_MAP.items():
        if key.lower() in (raw or "").lower():
            return val
    return "Social Welfare"


def tags_to_occupation(tags, category):
    tags_lower = [t.lower().strip() for t in (tags or []) if t]
    tags_set = set(tags_lower)
    for occ_tags, occ_value in OCCUPATION_TAG_MAP:
        for t in occ_tags:
            if t.lower() in tags_set:
                return occ_value
    if category == "Agriculture":
        return "farmer"
    if category == "Education":
        return "student"
    return "any"


def parse_age_from_api(age_field):
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
    min_age = min(min_ages) if min_ages else 0
    max_age = max(max_ages) if max_ages else 120
    if min_age > 100:
        min_age = 0
    if max_age < 5:
        max_age = 120
    return min_age, max_age


def detect_location_type(tags, name, description):
    """Detect Rural / Urban / any based on tags and text."""
    text = ((name or '') + ' ' + (description or '')).lower()
    tags_lower = {t.lower().strip() for t in (tags or []) if t}

    is_rural = bool(tags_lower & RURAL_TAGS) or any(w in text for w in [
        "rural", "village", "gram panchayat", "gramin", "kisan"
    ])
    is_urban = bool(tags_lower & URBAN_TAGS) or any(w in text for w in [
        "urban local body", "municipal corporation", "metro city", "ulb"
    ])

    if is_rural and is_urban:
        return "any"
    if is_rural:
        return "rural"
    if is_urban:
        return "urban"
    return "any"


def detect_education_min(tags, name, description):
    """Infer minimum education level from tags/text."""
    text = ((name or '') + ' ' + (description or '')).lower()
    tags_lower = [t.lower().strip() for t in (tags or []) if t]
    combined = text + " " + " ".join(tags_lower)

    for keyword, level in EDU_TAGS.items():
        if keyword in combined:
            return level
    return "any"


def fetch_all_schemes():
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

    cursor.execute("SELECT id, external_id, name, description FROM programs WHERE external_id IS NOT NULL")
    db_schemes = {row[1]: (row[0], row[2], row[3]) for row in cursor.fetchall()}
    print(f"Schemes in DB with external_id: {len(db_schemes)}")

    matched = 0
    occupation_counts = {}
    location_counts = {}
    education_counts = {}

    for slug, fields in api_schemes.items():
        if slug not in db_schemes:
            continue

        program_id, db_name, db_desc = db_schemes[slug]
        tags       = fields.get("tags") or []
        age_field  = fields.get("age") or {}
        raw_cats   = fields.get("schemeCategory") or []
        raw_cat    = raw_cats[0] if raw_cats else ""
        category   = map_category(raw_cat)

        # Ministry
        ministry_raw = fields.get("ministry") or fields.get("implementingAgency") or ""
        if isinstance(ministry_raw, list):
            ministry_raw = ministry_raw[0] if ministry_raw else ""
        ministry = str(ministry_raw)[:200] if ministry_raw else None

        # Structured age
        min_age, max_age = parse_age_from_api(age_field)

        # Occupation
        occ = tags_to_occupation(tags, category)

        # Gender + disability from tags
        tags_lower_set = {t.lower().strip() for t in tags if t}
        gender     = "female" if (tags_lower_set & FEMALE_TAGS) else "any"
        disability = 1 if (tags_lower_set & DISABILITY_TAGS) else 0

        # Location type
        loc_type = detect_location_type(tags, db_name, db_desc)

        # Education minimum
        edu_min = detect_education_min(tags, db_name, db_desc)

        # Tags as comma-separated string
        tags_str = ",".join(str(t) for t in tags[:15]) if tags else None
        if tags_str and len(tags_str) > 500:
            tags_str = tags_str[:500]

        cursor.execute("""
            UPDATE programs
            SET min_age = %s,
                max_age = %s,
                gender = %s,
                disability_required = %s,
                target_occupations = %s,
                ministry = %s,
                location_type = %s,
                education_min = %s,
                tags_list = %s
            WHERE id = %s
        """, (min_age, max_age, gender, disability, occ,
              ministry, loc_type, edu_min, tags_str, program_id))

        occupation_counts[occ] = occupation_counts.get(occ, 0) + 1
        location_counts[loc_type] = location_counts.get(loc_type, 0) + 1
        education_counts[edu_min] = education_counts.get(edu_min, 0) + 1
        matched += 1

    db.commit()
    cursor.close()
    db.close()

    print(f"\nDone!  Matched & updated: {matched} schemes")
    print("\nOccupation:")
    for k, v in sorted(occupation_counts.items(), key=lambda x: -x[1]):
        print(f"  {v:5d}  {k}")
    print("\nLocation type:")
    for k, v in sorted(location_counts.items(), key=lambda x: -x[1]):
        print(f"  {v:5d}  {k}")
    print("\nEducation min:")
    for k, v in sorted(education_counts.items(), key=lambda x: -x[1]):
        print(f"  {v:5d}  {k}")


if __name__ == "__main__":
    main()
