"""
Weekly Scheme Restore Script
Runs every Saturday - wipes all existing schemes from the database
and performs a full fresh import from the MyScheme API.

Usage:
    python restore_schemes.py

Scheduled automatically by Windows Task Scheduler (setup_scheduler.ps1).
"""

import os
import sys
import json
import time
import logging
import requests
import mysql.connector
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'backend', '.env'))

LOG_DIR = os.path.join(os.path.dirname(__file__), 'logs')
os.makedirs(LOG_DIR, exist_ok=True)

log_file = os.path.join(LOG_DIR, f"restore_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log")
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
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', 3306)),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', ''),
    'database': os.getenv('DB_NAME', 'gov_eligibility_db'),
}

MYSCHEME_API = "https://api.myscheme.gov.in/search/v4/schemes"
HEADERS = {
    "Accept": "application/json",
    "Accept-Language": "en",
}

CATEGORY_MAP = {
    "Agriculture,Rural & Environment": "Agriculture",
    "Banking,Financial Services and Insurance": "Financial Inclusion",
    "Business & Entrepreneurship": "Employment",
    "Education & Learning": "Education",
    "Health & Wellness": "Health",
    "Housing & Shelter": "Housing",
    "Public Safety,Law & Justice": "Social Welfare",
    "Science, IT & Communications": "Employment",
    "Skills & Employment": "Employment",
    "Social welfare & Empowerment": "Social Welfare",
    "Sports & Culture": "Social Welfare",
    "Transport & Infrastructure": "Social Welfare",
    "Travel & Tourism": "Social Welfare",
    "Utility & Sanitation": "Social Welfare",
    "Women and Child": "Women & Child",
    "Disability": "Disability Support",
}


def map_category(raw_category):
    for key, val in CATEGORY_MAP.items():
        if key.lower() in (raw_category or '').lower():
            return val
    return "Social Welfare"


def fetch_schemes(page=0, size=50):
    params = {
        "lang": "en",
        "keyword": "",
        "schemeType": "Central",
        "page": page,
        "size": size,
    }
    try:
        response = requests.get(MYSCHEME_API, headers=HEADERS, params=params, timeout=15)
        if response.status_code == 200:
            return response.json()
        else:
            log.warning(f"API error {response.status_code}: {response.text[:200]}")
            return None
    except Exception as e:
        log.error(f"Request failed: {e}")
        return None


def parse_age(value, default):
    try:
        v = str(value).strip().replace('+', '').replace('years', '').strip()
        return int(v) if v.isdigit() else default
    except Exception:
        return default


def parse_income(value, default):
    try:
        v = str(value).replace(',', '').replace('₹', '').replace('Rs', '').strip()
        v = v.split()[0]
        if 'lakh' in value.lower() or 'lac' in value.lower():
            return int(float(v) * 100000)
        return int(float(v))
    except Exception:
        return default


def extract_scheme_data(scheme):
    try:
        details = scheme.get('schemeContent', {}) or {}
        name = scheme.get('schemeName', '') or details.get('title', '')
        if not name:
            return None

        description = details.get('objective', '') or details.get('description', '') or name
        raw_category = ''
        tags = scheme.get('tags', []) or []
        if tags:
            raw_category = tags[0] if isinstance(tags[0], str) else tags[0].get('name', '')
        category = map_category(raw_category)

        # Women & Child schemes are female-only by nature
        if category == 'Women & Child':
            gender = 'female'

        eligibility = details.get('eligibility', []) or []
        min_age, max_age = 0, 120
        max_income = 99999999
        gender = 'any'
        caste = 'any'
        disability_required = False

        for criterion in eligibility:
            field = str(criterion.get('field', '')).lower()
            value = str(criterion.get('value', ''))

            if 'age' in field:
                if 'min' in field:
                    min_age = parse_age(value, 0)
                elif 'max' in field:
                    max_age = parse_age(value, 120)

            if 'income' in field or 'annual' in field:
                max_income = parse_income(value, 99999999)

            if 'gender' in field:
                val_lower = value.lower()
                if 'female' in val_lower or 'woman' in val_lower or 'girl' in val_lower:
                    gender = 'female'
                elif 'male' in val_lower or 'man' in val_lower or 'boy' in val_lower:
                    gender = 'male'

            if 'caste' in field or 'category' in field:
                val_upper = value.upper()
                if 'SC' in val_upper:
                    caste = 'SC'
                elif 'ST' in val_upper:
                    caste = 'ST'
                elif 'OBC' in val_upper:
                    caste = 'OBC'

            if 'disab' in field or 'pwd' in field or 'handicap' in field:
                disability_required = True

        official_link = scheme.get('schemeUrl', '') or ''
        # Ensure link has proper protocol
        if official_link and not official_link.startswith('http'):
            official_link = 'https://' + official_link.lstrip('/')
        state = scheme.get('state', 'All India') or 'All India'
        if not state or state.lower() in ['central', 'india', 'national']:
            state = 'All India'

        # Extract document requirements from scheme content
        raw_docs = details.get('documents', []) or details.get('requiredDocuments', []) or []
        doc_list = []
        for doc in raw_docs:
            if isinstance(doc, str) and doc.strip():
                doc_list.append(doc.strip())
            elif isinstance(doc, dict):
                label = doc.get('documentName', '') or doc.get('name', '') or doc.get('label', '')
                if label:
                    doc_list.append(label.strip())
        if not any('aadhaar' in d.lower() for d in doc_list):
            doc_list.insert(0, 'Aadhaar Card')
        documents_required = json.dumps(doc_list) if doc_list else None

        return {
            'name': name[:250],
            'description': description[:2000],
            'category': category,
            'min_age': min_age,
            'max_age': max_age,
            'min_income': 0,
            'max_income': max_income,
            'employment_status': 'any',
            'disability_required': disability_required,
            'citizenship_required': True,
            'gender': gender,
            'caste': caste,
            'state': state[:100],
            'official_link': official_link[:500] if official_link else None,
            'documents_required': documents_required,
        }
    except Exception as e:
        log.warning(f"Parse error: {e}")
        return None


def insert_scheme(cursor, scheme_data):
    sql = """
        INSERT INTO programs
          (name, description, category, min_age, max_age, min_income, max_income,
           employment_status, disability_required, citizenship_required,
           gender, caste, state, official_link, documents_required)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    cursor.execute(sql, (
        scheme_data['name'], scheme_data['description'], scheme_data['category'],
        scheme_data['min_age'], scheme_data['max_age'],
        scheme_data['min_income'], scheme_data['max_income'],
        scheme_data['employment_status'],
        scheme_data['disability_required'], scheme_data['citizenship_required'],
        scheme_data['gender'], scheme_data['caste'],
        scheme_data['state'], scheme_data['official_link'],
        scheme_data.get('documents_required'),
    ))


def main():
    log.info("=" * 60)
    log.info("WEEKLY RESTORE — MyScheme Full Re-Import")
    log.info(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    log.info("=" * 60)

    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()
        log.info(f"Connected to MySQL: {DB_CONFIG['database']}")
    except Exception as e:
        log.error(f"MySQL connection failed: {e}")
        sys.exit(1)

    # Wipe all existing schemes before fresh import
    log.info("Wiping existing schemes from 'programs' table...")
    cursor.execute("DELETE FROM programs")
    conn.commit()
    log.info("Table cleared. Starting full re-import...")

    total_inserted = 0
    total_failed = 0
    page = 0
    max_pages = 20

    while page < max_pages:
        log.info(f"Fetching page {page + 1}...")
        data = fetch_schemes(page=page, size=50)

        if not data:
            log.warning("No data returned. Stopping.")
            break

        schemes = data.get('data', {}).get('schemes', []) or data.get('schemes', []) or []
        if not schemes:
            log.info("No more schemes found. Import complete.")
            break

        log.info(f"  Got {len(schemes)} schemes from API")

        for scheme in schemes:
            parsed = extract_scheme_data(scheme)
            if parsed:
                try:
                    insert_scheme(cursor, parsed)
                    total_inserted += 1
                except Exception as e:
                    log.warning(f"  Insert error for '{parsed.get('name', 'unknown')}': {e}")
                    total_failed += 1

        conn.commit()
        log.info(f"  Committed. Running total: {total_inserted} inserted, {total_failed} failed")
        page += 1
        time.sleep(0.5)

    cursor.close()
    conn.close()

    log.info("\n" + "=" * 60)
    log.info("RESTORE COMPLETE")
    log.info(f"  Total inserted : {total_inserted}")
    log.info(f"  Total failed   : {total_failed}")
    log.info(f"  Log saved to   : {log_file}")
    log.info("=" * 60)


if __name__ == "__main__":
    main()
