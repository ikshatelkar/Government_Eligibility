"""
Daily Scheme Update Script
Fetches new/updated schemes from myscheme.gov.in using the v4 Search API
and individual scheme page scraping, then inserts them into the database.

Flow:
  1. Retrieve all current scheme slugs from the v4 API (paginated).
  2. Compare with external_id values already in the DB.
  3. For each new slug, fetch the scheme page and parse its __NEXT_DATA__ JSON.
  4. Insert newly discovered schemes.

Usage:
    python fetch_schemes.py

Requirements:
    pip install requests mysql-connector-python python-dotenv beautifulsoup4 brotli
"""

import os
import sys
import re
import json
import time
import logging
import requests
import mysql.connector
from datetime import datetime
from dotenv import load_dotenv

try:
    from bs4 import BeautifulSoup
except ImportError:
    print("beautifulsoup4 is required: pip install beautifulsoup4")
    sys.exit(1)

try:
    import brotli
    _BROTLI = True
except ImportError:
    _BROTLI = False

load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'backend', '.env'))

LOG_DIR = os.path.join(os.path.dirname(__file__), 'logs')
os.makedirs(LOG_DIR, exist_ok=True)

log_file = os.path.join(LOG_DIR, f"daily_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log")
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler(log_file, encoding='utf-8'),
        logging.StreamHandler(sys.stdout),
    ]
)
log = logging.getLogger(__name__)

DB_CONFIG = {
    'host':     os.getenv('DB_HOST', 'localhost'),
    'port':     int(os.getenv('DB_PORT', 3306)),
    'user':     os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', ''),
    'database': os.getenv('DB_NAME', 'gov_eligibility_db'),
}

# ── v4 Search API (discovered from open-source scraper) ──────────────────────
SEARCH_API  = "https://api.myscheme.gov.in/search/v4/schemes"
API_KEY     = "tYTy5eEhlu9rFjyxuCr7ra7ACp4dv1RH8gWuHTDc"
SCHEME_BASE = "https://www.myscheme.gov.in/schemes/"

API_HEADERS = {
    "Accept":          "application/json, text/plain, */*",
    "Accept-Encoding": "gzip, deflate, br",
    "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                       "AppleWebKit/537.36 (KHTML, like Gecko) "
                       "Chrome/135.0.0.0 Safari/537.36",
    "Origin":          "https://www.myscheme.gov.in",
    "Referer":         "https://www.myscheme.gov.in/search",
    "x-api-key":       API_KEY,
}

PAGE_HEADERS = {
    "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                       "AppleWebKit/537.36 (KHTML, like Gecko) "
                       "Chrome/135.0.0.0 Safari/537.36",
    "Accept-Language": "en-IN,en;q=0.9",
}

CATEGORY_MAP = {
    "Agriculture,Rural & Environment":           "Agriculture",
    "Banking,Financial Services and Insurance":  "Financial Inclusion",
    "Business & Entrepreneurship":               "Employment",
    "Education & Learning":                      "Education",
    "Health & Wellness":                         "Health",
    "Housing & Shelter":                         "Housing",
    "Public Safety,Law & Justice":               "Social Welfare",
    "Science, IT & Communications":              "Employment",
    "Skills & Employment":                       "Employment",
    "Social welfare & Empowerment":              "Social Welfare",
    "Sports & Culture":                          "Social Welfare",
    "Transport & Infrastructure":                "Social Welfare",
    "Travel & Tourism":                          "Social Welfare",
    "Utility & Sanitation":                      "Social Welfare",
    "Women and Child":                           "Women & Child",
    "Disability":                                "Disability Support",
}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def map_category(raw: str) -> str:
    for key, val in CATEGORY_MAP.items():
        if key.lower() in (raw or '').lower():
            return val
    return "Social Welfare"


def _decompress(resp: requests.Response) -> bytes:
    raw = resp.content
    enc = resp.headers.get("Content-Encoding", "")
    if "br" in enc and _BROTLI:
        try:
            raw = brotli.decompress(raw)
        except Exception:
            pass
    return raw


def parse_eligibility_text(text: str) -> dict:
    result = {
        'gender': 'any', 'min_age': 0, 'max_age': 120,
        'max_income': 99999999, 'caste': 'any', 'disability_required': False,
    }
    if not text:
        return result
    t = text.lower()

    if any(w in t for w in ['female', 'woman', 'women', 'girl', 'widow', 'mother']):
        result['gender'] = 'female'
    elif re.search(r'\b(male|man|men|boy)\b', t):
        result['gender'] = 'male'

    age_range = re.search(r'(\d{1,3})\s*(?:and|to|-)\s*(\d{1,3})\s*year', t)
    if age_range:
        a, b = int(age_range.group(1)), int(age_range.group(2))
        result['min_age'], result['max_age'] = min(a, b), max(a, b)
    else:
        min_m = re.search(
            r'(?:minimum|min|above|at least|completed)\s*(?:age\s*(?:of\s*)?)?(\d{1,3})', t)
        max_m = re.search(
            r'(?:maximum|max|below|up to|not (?:more|exceed)\w*)\s*(?:age\s*(?:of\s*)?)?(\d{1,3})', t)
        if min_m:
            result['min_age'] = int(min_m.group(1))
        if max_m:
            result['max_age'] = int(max_m.group(1))

    inc_m = re.search(r'(?:income|earning)[^\d]*?(\d[\d,\.]*)\s*(lakh|lac|thousand)?', t)
    if inc_m:
        try:
            val = float(inc_m.group(1).replace(',', ''))
            suf = (inc_m.group(2) or '').lower()
            if 'lakh' in suf or 'lac' in suf:
                val *= 100_000
            elif 'thousand' in suf:
                val *= 1_000
            result['max_income'] = int(val)
        except Exception:
            pass

    if re.search(r'\bsc\s*/?\s*st\b', t):
        result['caste'] = 'SC'
    elif re.search(r'\bsc\b', t):
        result['caste'] = 'SC'
    elif re.search(r'\bst\b', t):
        result['caste'] = 'ST'
    elif re.search(r'\bobc\b', t):
        result['caste'] = 'OBC'

    if any(w in t for w in ['disabilit', 'disabled', 'pwd', 'handicap', 'divyang']):
        result['disability_required'] = True

    return result


# ─── v4 API: get all slugs ────────────────────────────────────────────────────

def fetch_all_slugs(batch_size: int = 100) -> list[str]:
    """Return every slug currently listed in the MyScheme v4 API."""
    slugs, from_idx = [], 0
    while True:
        params = {
            "lang": "en", "q": "[]", "keyword": "",
            "sort": "", "from": str(from_idx), "size": str(batch_size),
        }
        try:
            resp = requests.get(SEARCH_API, headers=API_HEADERS, params=params, timeout=20)
            resp.raise_for_status()
            data = json.loads(_decompress(resp).decode('utf-8'))
        except Exception as e:
            log.warning(f"  Slug fetch error at from={from_idx}: {e}")
            break

        items = data.get("data", {}).get("hits", {}).get("items", [])
        if not items:
            break

        for item in items:
            slug = item.get("fields", {}).get("slug")
            if slug:
                slugs.append(slug)

        total = data.get("data", {}).get("hits", {}).get("total", {})
        if isinstance(total, dict):
            total = total.get("value", 0)
        total = int(total or 0)

        from_idx += batch_size
        log.info(f"  Fetched {len(slugs)} / {total} slugs ...")

        if from_idx >= total:
            break
        time.sleep(0.3)

    return slugs


# ─── Individual scheme page parsing ──────────────────────────────────────────

def safe_label(obj: dict, key: str) -> str:
    val = obj.get(key)
    if isinstance(val, dict):
        return str(val.get('label', '') or '')
    return str(val or '')


def fetch_scheme_page(slug: str) -> dict | None:
    """Fetch and parse a single scheme page, returning structured data."""
    url = SCHEME_BASE + slug
    try:
        resp = requests.get(url, headers=PAGE_HEADERS, timeout=15)
        if resp.status_code != 200:
            log.warning(f"  {slug}: HTTP {resp.status_code}")
            return None

        soup = BeautifulSoup(resp.text, 'html.parser')
        script = soup.find('script', {'id': '__NEXT_DATA__'})
        if not script or not script.string:
            log.warning(f"  {slug}: no __NEXT_DATA__ found")
            return None

        page_data = json.loads(script.string)
        props = page_data.get('props', {}).get('pageProps', {})
        sd = props.get('schemeData', {}).get('en', {})
        if not sd:
            return None

        basics = sd.get('basicDetails', {}) or {}
        name = basics.get('schemeName', '').strip()
        if not name:
            return None

        tags_raw = basics.get('tags', []) or []
        tags = [str(t) for t in tags_raw]
        raw_cat = tags[0] if tags else ''
        category = map_category(raw_cat)

        state = safe_label(basics, 'state') or 'All India'
        if state.lower() in {'central', 'india', 'national', ''}:
            state = 'All India'

        elig_text = sd.get('eligibilityCriteria', {}).get('eligibilityDescription_md', '') or ''
        elig = parse_eligibility_text(elig_text)

        if category == 'Women & Child':
            elig['gender'] = 'female'
        if category == 'Disability Support':
            elig['disability_required'] = True

        desc_raw = (
            sd.get('schemeContent', {}).get('detailedDescription_md', '')
            or sd.get('schemeContent', {}).get('shortTitle', '')
            or name
        )
        description = re.sub(r'&[a-z]+;|&#\d+;|&amp;|\*+', ' ', desc_raw).strip()[:2000]

        # Documents from the rendered HTML section
        docs = []
        doc_div = soup.find('div', id='documents-required')
        if doc_div:
            md_div = doc_div.find('div', class_='markdown-options')
            if md_div:
                lines = re.split(r'\n|•', md_div.get_text('\n', strip=True))
                for line in lines:
                    line = re.sub(r'\*+|\[|\]', '', line).strip(' ->')
                    if 4 < len(line) < 200:
                        docs.append(line)
        docs = docs[:15]
        if not docs:
            docs = ['Aadhaar Card']
        elif not any('aadhaar' in d.lower() for d in docs):
            docs.insert(0, 'Aadhaar Card')

        return {
            'name':                name[:250],
            'description':         description,
            'category':            category,
            'min_age':             elig['min_age'],
            'max_age':             elig['max_age'],
            'min_income':          0,
            'max_income':          elig['max_income'],
            'employment_status':   'any',
            'disability_required': elig['disability_required'],
            'citizenship_required': True,
            'gender':              elig['gender'],
            'caste':               elig['caste'],
            'state':               state[:100],
            'official_link':       url,
            'documents_required':  json.dumps(docs),
            'external_id':         slug,
        }
    except Exception as e:
        log.warning(f"  {slug}: parse error — {e}")
        return None


# ─── Database ─────────────────────────────────────────────────────────────────

INSERT_SQL = """
    INSERT IGNORE INTO programs
      (name, description, category, min_age, max_age, min_income, max_income,
       employment_status, disability_required, citizenship_required,
       gender, caste, state, official_link, documents_required,
       external_id, source_api, last_synced_at)
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
"""


def get_existing_ids(cursor) -> set:
    cursor.execute("SELECT external_id FROM programs WHERE external_id IS NOT NULL")
    return {row[0] for row in cursor.fetchall()}


def insert_scheme(cursor, d: dict):
    cursor.execute(INSERT_SQL, (
        d['name'], d['description'], d['category'],
        d['min_age'], d['max_age'], d['min_income'], d['max_income'],
        d['employment_status'], d['disability_required'], d['citizenship_required'],
        d['gender'], d['caste'], d['state'], d['official_link'],
        d['documents_required'], d['external_id'], 'myscheme_v4',
    ))


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    log.info("=" * 60)
    log.info("DAILY UPDATE — MyScheme v4 API incremental sync")
    log.info(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    log.info("=" * 60)

    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()
        log.info(f"Connected to MySQL: {DB_CONFIG['database']}")
    except Exception as e:
        log.error(f"MySQL connection failed: {e}")
        sys.exit(1)

    log.info("Fetching all slugs from MyScheme v4 API ...")
    all_slugs = fetch_all_slugs()
    log.info(f"API returned {len(all_slugs)} total slugs")

    if not all_slugs:
        log.warning("No slugs retrieved. Exiting.")
        cursor.close()
        conn.close()
        sys.exit(0)

    existing_ids = get_existing_ids(cursor)
    log.info(f"DB already has {len(existing_ids)} schemes with external_id")

    new_slugs = [s for s in all_slugs if s not in existing_ids]
    log.info(f"New schemes to import: {len(new_slugs)}")

    if not new_slugs:
        log.info("No new schemes found. Database is up to date.")
        cursor.close()
        conn.close()
        return

    inserted, failed = 0, 0
    for i, slug in enumerate(new_slugs, 1):
        log.info(f"  [{i}/{len(new_slugs)}] {slug}")
        data = fetch_scheme_page(slug)
        if data:
            try:
                insert_scheme(cursor, data)
                if cursor.rowcount > 0:
                    inserted += 1
                else:
                    log.info(f"    Skipped (duplicate name)")
            except Exception as e:
                log.warning(f"    DB insert error: {e}")
                failed += 1
        else:
            failed += 1

        if i % 20 == 0:
            conn.commit()
            log.info(f"  Committed batch. +{inserted} so far.")

        time.sleep(0.8)  # polite delay between page fetches

    conn.commit()
    cursor.close()
    conn.close()

    log.info("\n" + "=" * 60)
    log.info("DAILY UPDATE COMPLETE")
    log.info(f"  New schemes found  : {len(new_slugs)}")
    log.info(f"  Inserted           : {inserted}")
    log.info(f"  Failed/skipped     : {failed}")
    log.info(f"  Log saved to       : {log_file}")
    log.info("=" * 60)


if __name__ == "__main__":
    main()
