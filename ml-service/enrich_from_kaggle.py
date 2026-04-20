"""
enrich_from_kaggle.py
Reads the Kaggle 'indian-government-schemes' dataset and uses it to enrich
our MySQL programs table with better eligibility fields, benefits, how_to_apply,
and documents_required — matched by slug (external_id).

Run:  python enrich_from_kaggle.py
"""

import os, sys, re, json, logging
import pandas as pd
import mysql.connector
from dotenv import load_dotenv
from datetime import datetime

load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'backend', '.env'))

LOG_DIR = os.path.join(os.path.dirname(__file__), 'logs')
os.makedirs(LOG_DIR, exist_ok=True)
log_file = os.path.join(LOG_DIR, f"kaggle_enrich_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log")
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[logging.FileHandler(log_file, encoding='utf-8'), logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger(__name__)

CSV_PATH = r'C:\Users\Nochu\.cache\kagglehub\datasets\jainamgada45\indian-government-schemes\versions\1\updated_data.csv'

DB_CONFIG = {
    'host':     os.getenv('DB_HOST', 'localhost'),
    'port':     int(os.getenv('DB_PORT', 3306)),
    'user':     os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', ''),
    'database': os.getenv('DB_NAME', 'gov_eligibility_db'),
}

# ── Eligibility text parsers ──────────────────────────────────────────────────

def parse_gender(text: str) -> str:
    t = text.lower()
    female_kw = ['female', 'woman', 'women', 'girl', 'widow', 'mother', 'wife', 'daughter']
    male_kw   = [r'\bmale\b', r'\bman\b', r'\bmen\b', r'\bboy\b']
    has_female = any(w in t for w in female_kw)
    has_male   = any(re.search(p, t) for p in male_kw)
    if has_female and has_male:
        return 'any'
    if has_female:
        return 'female'
    if has_male:
        return 'male'
    return 'any'


def parse_age(text: str):
    t = text.lower()
    min_age, max_age = 0, 120

    # e.g. "18 to 60 years" or "18-60 years"
    m = re.search(r'(\d{1,3})\s*(?:to|-)\s*(\d{1,3})\s*year', t)
    if m:
        a, b = int(m.group(1)), int(m.group(2))
        return min(a, b), max(a, b)

    # min age
    m_min = re.search(
        r'(?:minimum|min(?:imum)?|above|at least|completed|not less than)\s*(?:age\s*(?:of\s*)?)?(\d{1,3})', t)
    m_max = re.search(
        r'(?:maximum|max(?:imum)?|below|up to|not (?:more|exceed)\w*|less than)\s*(?:age\s*(?:of\s*)?)?(\d{1,3})', t)
    if m_min:
        min_age = int(m_min.group(1))
    if m_max:
        max_age = int(m_max.group(1))
    return min_age, max_age


def parse_income(text: str) -> int:
    t = text.lower()
    m = re.search(
        r'(?:annual\s+)?(?:family\s+)?income[^\d]{0,30}?(\d[\d,\.]*)\s*(lakh|lac|thousand|crore)?',
        t)
    if m:
        try:
            val = float(m.group(1).replace(',', ''))
            suf = (m.group(2) or '').lower()
            if 'crore' in suf:
                val *= 1_00_00_000
            elif 'lakh' in suf or 'lac' in suf:
                val *= 1_00_000
            elif 'thousand' in suf:
                val *= 1_000
            return int(val)
        except Exception:
            pass
    return 99999999


def parse_caste(text: str) -> str:
    t = text.lower()
    if re.search(r'\bsc\s*/?\s*st\b', t):
        return 'SC'
    if re.search(r'\bscheduled\s+caste\b', t):
        return 'SC'
    if re.search(r'\bscheduled\s+tribe\b', t):
        return 'ST'
    if re.search(r'\bsc\b', t):
        return 'SC'
    if re.search(r'\bst\b', t):
        return 'ST'
    if re.search(r'\bobc\b', t) or 'other backward' in t:
        return 'OBC'
    # Minority is not a separate caste ENUM value — treat as 'any'
    return 'any'


def parse_disability(text: str) -> bool:
    t = text.lower()
    return any(w in t for w in ['disabilit', 'disabled', 'pwd', 'handicap', 'divyang', 'differently abled'])


def parse_documents(raw: str) -> list:
    if not raw or str(raw).strip().lower() in ('nan', ''):
        return []
    # Split on common separators
    parts = re.split(r'\.\s+(?=[A-Z])|;\s*|\n', str(raw))
    docs = []
    for p in parts:
        p = p.strip().strip('.')
        if 4 < len(p) < 200:
            docs.append(p)
    return docs[:15]


def parse_occupation(text: str) -> str:
    """Return comma-separated target occupations or 'any'."""
    t = text.lower()
    found = []
    if re.search(r'\bfarmer\b|\bagricultur\b|\bkisan\b', t):
        found.append('farmer')
    if re.search(r'\bstudent\b|\bscholar\b|\bpupil\b', t):
        found.append('student')
    if re.search(r'\bstreet vendor\b|\bhawker\b|\bvending\b', t):
        found.append('street_vendor')
    if re.search(r'\bunorganis\b|\bunorganiz\b|\binformal\s+worker\b|\bdaily\s+wage\b', t):
        found.append('unorganised_worker')
    if re.search(r'\bbusiness\b|\bentrepreneur\b|\bself.employed\b|\bmsme\b|\bshg\b', t):
        found.append('business')
    if re.search(r'\barmed\s+force\b|\bex.service\b|\bsoldier\b|\bdefence\b|\bnavy\b|\bair\s+force\b', t):
        found.append('armed_forces')
    if re.search(r'\bgovernment\s+employee\b|\bgovernment\s+servant\b|\bpublic\s+servant\b', t):
        found.append('government_employee')
    if re.search(r'\bprivate\s+employee\b|\bprivate\s+sector\b|\bsalaried\b', t):
        found.append('private_employee')
    if re.search(r'\bhomemaker\b|\bhousewife\b|\bhouseholder\b', t):
        found.append('homemaker')
    if re.search(r'\bconstruction\s+worker\b|\bbuilding\s+worker\b|\blabou?rer\b', t):
        found.append('unorganised_worker')
    return ','.join(found) if found else 'any'


# ── Category mapping ──────────────────────────────────────────────────────────
CATEGORY_MAP = {
    "agriculture":        "Agriculture",
    "education":          "Education",
    "health":             "Health",
    "housing":            "Housing",
    "women and child":    "Women & Child",
    "business":           "Employment",
    "skills & employment":"Employment",
    "disability":         "Disability Support",
    "banking":            "Financial Inclusion",
    "financial":          "Financial Inclusion",
    "social welfare":     "Social Welfare",
    "sports":             "Social Welfare",
    "science":            "Employment",
    "public safety":      "Social Welfare",
    "transport":          "Social Welfare",
    "utility":            "Social Welfare",
    "travel":             "Social Welfare",
}

def map_category(raw: str) -> str:
    r = (raw or '').lower()
    if 'women and child' in r:
        return 'Women & Child'
    if 'disability' in r:
        return 'Disability Support'
    for key, val in CATEGORY_MAP.items():
        if key in r:
            return val
    return 'Social Welfare'


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    log.info("=" * 60)
    log.info("KAGGLE DATASET ENRICHMENT")
    log.info("=" * 60)

    log.info(f"Loading CSV: {CSV_PATH}")
    df = pd.read_csv(CSV_PATH, encoding='utf-8')
    log.info(f"CSV rows: {len(df)}")

    conn   = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor(dictionary=True)

    # Build slug → DB row map
    cursor.execute("SELECT id, external_id, name, gender, min_age, max_age, max_income, caste, "
                   "target_occupations, disability_required FROM programs WHERE is_active = TRUE")
    db_rows = cursor.fetchall()
    slug_map = {(r['external_id'] or '').strip(): r for r in db_rows}
    log.info(f"DB rows loaded: {len(db_rows)}, unique slugs: {len(slug_map)}")

    updated = skipped = not_found = 0

    for _, row in df.iterrows():
        slug = str(row['slug']).strip()
        if slug not in slug_map:
            not_found += 1
            continue

        db   = slug_map[slug]
        elig = str(row.get('eligibility', '') or '')

        # Parse fields from eligibility text
        min_age, max_age = parse_age(elig)
        max_income       = parse_income(elig)
        gender           = parse_gender(elig)
        caste            = parse_caste(elig)
        disability       = parse_disability(elig)
        occupation       = parse_occupation(elig)

        # Only update age if current DB has default (0 / 120) AND we found something specific
        new_min_age  = min_age  if min_age  > 0   else db['min_age']
        new_max_age  = max_age  if max_age  < 120  else db['max_age']
        new_income   = max_income if max_income < 99999999 else db['max_income']
        new_gender   = gender   if gender != 'any' else db['gender']
        new_caste    = caste    if caste  != 'any' else db['caste']
        new_disability = disability or db['disability_required']
        # Occupation: use CSV value if it provides more info
        db_occ = (db['target_occupations'] or 'any').strip()
        new_occ = occupation if occupation != 'any' else db_occ

        # Benefits
        benefits_raw = str(row.get('benefits', '') or '').strip()
        if benefits_raw.lower() == 'nan':
            benefits_raw = ''

        # How to apply
        apply_raw = str(row.get('application', '') or '').strip()
        if apply_raw.lower() == 'nan':
            apply_raw = ''

        # Documents
        docs_raw  = str(row.get('documents', '') or '').strip()
        docs_list = parse_documents(docs_raw)
        if not docs_list:
            docs_list = ['Aadhaar Card']
        elif not any('aadhaar' in d.lower() for d in docs_list):
            docs_list.insert(0, 'Aadhaar Card')
        docs_json = json.dumps(docs_list)

        # Category
        cat_raw = str(row.get('schemeCategory', '') or '')
        category = map_category(cat_raw)

        try:
            cursor.execute("""
                UPDATE programs SET
                    min_age              = %s,
                    max_age              = %s,
                    max_income           = %s,
                    gender               = %s,
                    caste                = %s,
                    disability_required  = %s,
                    target_occupations   = %s,
                    benefits             = %s,
                    how_to_apply         = %s,
                    documents_required   = %s,
                    category             = %s
                WHERE id = %s
            """, (
                new_min_age, new_max_age, new_income,
                new_gender, new_caste, new_disability,
                new_occ, benefits_raw[:2000] or None,
                apply_raw[:2000] or None,
                docs_json, category,
                db['id']
            ))
            updated += 1
        except Exception as e:
            log.warning(f"  Update error for slug={slug}: {e}")
            skipped += 1

        if updated % 200 == 0 and updated > 0:
            conn.commit()
            log.info(f"  Progress: {updated} updated ...")

    conn.commit()
    cursor.close()
    conn.close()

    log.info("\n" + "=" * 60)
    log.info("ENRICHMENT COMPLETE")
    log.info(f"  Updated  : {updated}")
    log.info(f"  Not found: {not_found}")
    log.info(f"  Errors   : {skipped}")
    log.info(f"  Log      : {log_file}")
    log.info("=" * 60)


if __name__ == '__main__':
    main()
