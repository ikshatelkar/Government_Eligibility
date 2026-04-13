"""
CSV Import Script — Import ~3,300 government schemes from pre-scraped dataset.

Downloads cleaned_my_scheme_data_fixed.csv from GitHub (Bhagawat8/Government-Scheme-QnA-using-RAG-on-MyScheme-Portal)
and inserts all schemes into the MySQL programs table.

Usage:
    python import_from_csv.py           # interactive (prompts if DB has data)
    python import_from_csv.py --force   # skip prompt, always wipe and re-import

Requirements:
    pip install requests mysql-connector-python python-dotenv pandas beautifulsoup4
"""

import os
import sys
import re
import io
import ast
import json
import logging
import argparse
import requests
import mysql.connector
from datetime import datetime
from dotenv import load_dotenv

try:
    import pandas as pd
except ImportError:
    print("pandas is required: pip install pandas")
    sys.exit(1)

load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'backend', '.env'))

LOG_DIR = os.path.join(os.path.dirname(__file__), 'logs')
os.makedirs(LOG_DIR, exist_ok=True)

log_file = os.path.join(LOG_DIR, f"csv_import_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log")
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler(log_file, encoding='utf-8'),
        logging.StreamHandler(sys.stdout),
    ]
)
log = logging.getLogger(__name__)

CSV_URL = (
    "https://raw.githubusercontent.com/Bhagawat8/"
    "Government-Scheme-QnA-using-RAG-on-MyScheme-Portal/main/"
    "cleaned_my_scheme_data_fixed.csv"
)

DB_CONFIG = {
    'host':     os.getenv('DB_HOST', 'localhost'),
    'port':     int(os.getenv('DB_PORT', 3306)),
    'user':     os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', ''),
    'database': os.getenv('DB_NAME', 'gov_eligibility_db'),
}

# Category inference: checked in order, first match wins
CATEGORY_RULES = [
    ('Women & Child',      ['women', 'woman', 'girl', 'child', 'mother', 'pregnant',
                            'maternity', 'widow', 'beti', 'ladli']),
    ('Education',          ['education', 'student', 'scholarship', 'school', 'college',
                            'university', 'learning', 'study', 'merit', 'fellowship']),
    ('Health',             ['health', 'medical', 'hospital', 'medicine', 'doctor',
                            'patient', 'disease', 'wellness', 'ayushman', 'jan arogya',
                            'nutrition', 'sanitation']),
    ('Agriculture',        ['farmer', 'agriculture', 'crop', 'farm', 'kisan', 'soil',
                            'irrigation', 'rural', 'livestock', 'fishermen', 'fishing',
                            'horticulture']),
    ('Employment',         ['employment', 'job', 'skill', 'training', 'entrepreneur',
                            'business', 'startup', 'msme', 'labour', 'worker', 'industry',
                            'vocational']),
    ('Housing',            ['housing', 'home', 'shelter', 'house', 'awas', 'construction']),
    ('Disability Support', ['disability', 'disabled', 'pwd', 'handicap', 'divyangjan',
                            'divyang', 'specially abled']),
    ('Financial Inclusion',['financial', 'insurance', 'banking', 'pension', 'savings',
                            'loan', 'credit', 'jan dhan', 'mudra', 'suraksha']),
]

CENTRAL_STATES = {'central', 'central government', 'india', 'national', '', 'nan'}


# ─── Parsing helpers ──────────────────────────────────────────────────────────

def infer_category(tags_str: str) -> str:
    try:
        tags = ast.literal_eval(tags_str) if tags_str and str(tags_str) != 'nan' else []
    except Exception:
        tags = [str(tags_str)]
    text = ' '.join(str(t) for t in tags).lower()
    for cat, keywords in CATEGORY_RULES:
        if any(kw in text for kw in keywords):
            return cat
    return 'Social Welfare'


def extract_state(states_str: str) -> str:
    """
    Parse the target_beneficiaries_states column.
    Format is a Python list string: "['Kerala', 'Tamil Nadu']" or "['All India']"
    """
    try:
        if not states_str or str(states_str) == 'nan':
            return 'All India'
        items = ast.literal_eval(str(states_str))
        if not items:
            return 'All India'
        first = str(items[0]).strip()
        if first.lower() in CENTRAL_STATES or first.lower() in ('all states', 'pan india'):
            return 'All India'
        # If multiple states, pick the first one (we store one state per row)
        return first[:100]
    except Exception:
        # Try raw string fallback
        s = str(states_str).strip().strip("[]'\"")
        if not s or s.lower() in CENTRAL_STATES:
            return 'All India'
        return s[:100]


def parse_eligibility(elig_text: str) -> dict:
    """
    Parse eligibility markdown text to extract structured criteria:
    gender, age range, income limit, caste, disability flag.
    """
    result = {
        'gender':             'any',
        'min_age':            0,
        'max_age':            120,
        'max_income':         99999999,
        'caste':              'any',
        'disability_required': False,
    }
    if not elig_text or str(elig_text) == 'nan':
        return result

    text = str(elig_text).lower()

    # Gender
    if any(w in text for w in ['female', 'woman', 'women', 'girl', 'beti', 'widow', 'mother']):
        result['gender'] = 'female'
    elif re.search(r'\b(male|man|men|boy)\b', text) and result['gender'] == 'any':
        result['gender'] = 'male'

    # Age range "between 18 and 40 / 18 to 40 / 18-40 years"
    age_range = re.search(r'(\d{1,3})\s*(?:and|to|-)\s*(\d{1,3})\s*year', text)
    if age_range:
        a, b = int(age_range.group(1)), int(age_range.group(2))
        result['min_age'], result['max_age'] = min(a, b), max(a, b)
    else:
        min_m = re.search(
            r'(?:minimum|min(?:imum)?|above|at least|completed|attained)\s*'
            r'(?:age\s*(?:of\s*)?)?(\d{1,3})',
            text
        )
        max_m = re.search(
            r'(?:maximum|max(?:imum)?|below|up to|not (?:more|exceed)\w*|less than)\s*'
            r'(?:age\s*(?:of\s*)?)?(\d{1,3})',
            text
        )
        if min_m:
            result['min_age'] = int(min_m.group(1))
        if max_m:
            result['max_age'] = int(max_m.group(1))

    # Income
    income_m = re.search(
        r'(?:income|earning|salary)[^\d]*?(\d[\d,\.]*)\s*(lakh|lac|thousand)?',
        text
    )
    if income_m:
        try:
            val = float(income_m.group(1).replace(',', ''))
            suffix = (income_m.group(2) or '').lower()
            if 'lakh' in suffix or 'lac' in suffix:
                val *= 100_000
            elif 'thousand' in suffix:
                val *= 1_000
            result['max_income'] = int(val)
        except Exception:
            pass

    # Caste
    if re.search(r'\bsc\s*/?\s*st\b', text):
        result['caste'] = 'SC'
    elif re.search(r'\bsc\b', text):
        result['caste'] = 'SC'
    elif re.search(r'\bst\b', text):
        result['caste'] = 'ST'
    elif re.search(r'\bobc\b', text):
        result['caste'] = 'OBC'

    # Disability
    if any(w in text for w in ['disabilit', 'disabled', 'pwd', 'handicap', 'divyang']):
        result['disability_required'] = True

    return result


def parse_documents(docs_text: str) -> str:
    """Convert documents-required text/list into a compact JSON list."""
    if not docs_text or str(docs_text) == 'nan':
        return json.dumps(['Aadhaar Card'])

    # Try to parse as Python list first (CSV stores list as string)
    try:
        items = ast.literal_eval(str(docs_text))
        if isinstance(items, list):
            docs = [str(d).strip() for d in items if str(d).strip() and len(str(d).strip()) > 3]
            docs = docs[:15]
            if not docs:
                docs = ['Aadhaar Card']
            elif not any('aadhaar' in d.lower() for d in docs):
                docs.insert(0, 'Aadhaar Card')
            return json.dumps(docs)
    except Exception:
        pass

    # Fallback: split on newlines, bullets, numbered points
    lines = re.split(r'\n|•|\*\s+|\d+\.\s+', str(docs_text))
    docs = []
    for line in lines:
        line = re.sub(r'\*+|\[|\]|&[a-z]+;|&#\d+;|`', '', line).strip(' -–>')
        if 4 < len(line) < 200:
            docs.append(line)

    docs = docs[:15]
    if not docs:
        docs = ['Aadhaar Card']
    elif not any('aadhaar' in d.lower() for d in docs):
        docs.insert(0, 'Aadhaar Card')
    return json.dumps(docs)


# ─── Download ─────────────────────────────────────────────────────────────────

def download_csv() -> bytes | None:
    log.info(f"Downloading CSV from GitHub ...")
    log.info(f"  URL: {CSV_URL}")
    try:
        resp = requests.get(CSV_URL, timeout=180, stream=True)
        resp.raise_for_status()
        total = int(resp.headers.get('content-length', 0))
        chunks, downloaded = [], 0
        for chunk in resp.iter_content(chunk_size=131072):
            chunks.append(chunk)
            downloaded += len(chunk)
            if total and downloaded % (1024 * 512) < 131072:
                log.info(f"  {downloaded // 1024} / {total // 1024} KB  "
                         f"({downloaded * 100 // total}%)")
        content = b''.join(chunks)
        log.info(f"  Download complete: {len(content) // 1024} KB")
        return content
    except Exception as e:
        log.error(f"Download failed: {e}")
        return None


# ─── Main ─────────────────────────────────────────────────────────────────────

INSERT_SQL = """
    INSERT IGNORE INTO programs
      (name, description, category, min_age, max_age, min_income, max_income,
       employment_status, disability_required, citizenship_required,
       gender, caste, state, official_link, documents_required,
       external_id, source_api)
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
"""


def parse_eligibility_list(elig_raw: str) -> dict:
    """
    The CSV stores eligibility as a Python list of sentences, e.g.:
    "['The applicant must be female', 'Age should be above 18 years']"
    Join them into one string and delegate to parse_eligibility().
    """
    try:
        items = ast.literal_eval(str(elig_raw))
        if isinstance(items, list):
            return parse_eligibility(' '.join(str(x) for x in items))
    except Exception:
        pass
    return parse_eligibility(str(elig_raw))


def import_dataframe(df: 'pd.DataFrame', cursor, conn) -> tuple[int, int, int]:
    inserted, skipped, errors = 0, 0, 0

    for i, row in df.iterrows():
        try:
            # CSV uses snake_case column names in the cleaned version
            name = str(row.get('scheme_name', '') or '').strip()
            if not name or name == 'nan':
                skipped += 1
                continue

            raw_desc = row.get('details', '') or row.get('benefits', '') or name
            description = re.sub(r'&[a-z]+;|&#\d+;|&amp;|\u2019|\u201c|\u201d|\ufffd',
                                  ' ', str(raw_desc)).strip()
            if not description or description == 'nan':
                description = name
            description = description[:2000]

            tags_str = str(row.get('tags', '') or '')
            category = infer_category(tags_str)

            state = extract_state(str(row.get('target_beneficiaries_states', '') or ''))

            elig = parse_eligibility_list(str(row.get('eligibility', '') or ''))

            if category == 'Women & Child':
                elig['gender'] = 'female'
            if category == 'Disability Support':
                elig['disability_required'] = True

            source_url = str(row.get('source_url', '') or '').strip()
            if source_url == 'nan':
                source_url = ''
            external_id = source_url.rstrip('/').split('/')[-1] if source_url else None

            documents_required = parse_documents(str(row.get('documents_required', '') or ''))

            cursor.execute(INSERT_SQL, (
                name[:250],
                description,
                category,
                elig['min_age'],
                elig['max_age'],
                0,
                elig['max_income'],
                'any',
                elig['disability_required'],
                True,
                elig['gender'],
                elig['caste'],
                state,
                source_url[:500] if source_url else None,
                documents_required,
                external_id[:150] if external_id else None,
                'myscheme_csv',
            ))

            inserted += 1  # count every successful execute (INSERT IGNORE won't raise on dup)

            if (i + 1) % 200 == 0:
                conn.commit()
                log.info(f"  Progress: {i + 1}/{len(df)}  |  "
                         f"+{inserted} inserted  |  {skipped} skipped")

        except Exception as e:
            log.warning(f"  Row {i} error ('{str(row.get('scheme_name', ''))[:40]}'): {e}")
            errors += 1

    conn.commit()
    return inserted, skipped, errors


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--force', action='store_true',
                        help='Wipe existing schemes without prompting')
    args = parser.parse_args()

    log.info("=" * 60)
    log.info("CSV IMPORT — MyScheme Pre-Scraped Dataset")
    log.info(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    log.info("=" * 60)

    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()
        log.info(f"Connected to MySQL: {DB_CONFIG['database']}")
    except Exception as e:
        log.error(f"MySQL connection failed: {e}")
        sys.exit(1)

    cursor.execute("SELECT COUNT(*) FROM programs")
    existing = cursor.fetchone()[0]
    log.info(f"Current schemes in DB: {existing}")

    if existing > 0:
        if args.force:
            log.info("--force flag set. Clearing existing schemes...")
        else:
            ans = input(f"\nDB already has {existing} schemes.\n"
                        "Clear and re-import everything? (y/N): ").strip().lower()
            if ans != 'y':
                log.info("Import cancelled.")
                cursor.close()
                conn.close()
                sys.exit(0)
        cursor.execute("DELETE FROM programs")
        conn.commit()
        log.info("Existing schemes cleared.")

    csv_data = download_csv()
    if csv_data is None:
        cursor.close()
        conn.close()
        sys.exit(1)

    log.info("Parsing CSV ...")
    try:
        df = pd.read_csv(io.BytesIO(csv_data), encoding='utf-8', low_memory=False)
        # Drop rows that are clearly errors (have a value in the 'error' column)
        if 'error' in df.columns:
            df = df[df['error'].isna()].reset_index(drop=True)
        log.info(f"Loaded {len(df)} valid rows from CSV")
    except Exception as e:
        log.error(f"Failed to parse CSV: {e}")
        cursor.close()
        conn.close()
        sys.exit(1)

    log.info("Importing schemes into database ...")
    inserted, skipped, errors = import_dataframe(df, cursor, conn)

    cursor.close()
    conn.close()

    log.info("\n" + "=" * 60)
    log.info("CSV IMPORT COMPLETE")
    log.info(f"  CSV rows processed : {len(df)}")
    log.info(f"  Inserted           : {inserted}")
    log.info(f"  Skipped            : {skipped}  (duplicates or empty name)")
    log.info(f"  Errors             : {errors}")
    log.info(f"  Log saved to       : {log_file}")
    log.info("=" * 60)


if __name__ == "__main__":
    main()
