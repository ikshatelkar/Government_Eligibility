"""
MyScheme API Import Script
Fetches Indian government schemes from myscheme.gov.in API
and inserts them into the MySQL database.

Usage:
    python fetch_schemes.py

Requirements:
    pip install requests mysql-connector-python python-dotenv
"""

import os
import json
import time
import requests
import mysql.connector
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'backend', '.env'))

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
            print(f"  API error {response.status_code}: {response.text[:200]}")
            return None
    except Exception as e:
        print(f"  Request failed: {e}")
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
        state = scheme.get('state', 'All India') or 'All India'
        if not state or state.lower() in ['central', 'india', 'national']:
            state = 'All India'

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
        }
    except Exception as e:
        print(f"  Parse error: {e}")
        return None

def insert_scheme(cursor, scheme_data):
    sql = """
        INSERT IGNORE INTO programs
          (name, description, category, min_age, max_age, min_income, max_income,
           employment_status, disability_required, citizenship_required,
           gender, caste, state, official_link)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    cursor.execute(sql, (
        scheme_data['name'], scheme_data['description'], scheme_data['category'],
        scheme_data['min_age'], scheme_data['max_age'],
        scheme_data['min_income'], scheme_data['max_income'],
        scheme_data['employment_status'],
        scheme_data['disability_required'], scheme_data['citizenship_required'],
        scheme_data['gender'], scheme_data['caste'],
        scheme_data['state'], scheme_data['official_link'],
    ))

def main():
    print("=" * 60)
    print("MyScheme API → MySQL Importer")
    print("=" * 60)

    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()
        print(f"Connected to MySQL: {DB_CONFIG['database']}\n")
    except Exception as e:
        print(f"MySQL connection failed: {e}")
        print("Make sure your backend/.env has correct DB credentials.")
        return

    total_inserted = 0
    total_skipped = 0
    page = 0
    max_pages = 20

    while page < max_pages:
        print(f"Fetching page {page + 1}...")
        data = fetch_schemes(page=page, size=50)

        if not data:
            print("  No data returned. Stopping.")
            break

        schemes = data.get('data', {}).get('schemes', []) or data.get('schemes', []) or []
        if not schemes:
            print("  No more schemes found.")
            break

        print(f"  Got {len(schemes)} schemes from API")

        for scheme in schemes:
            parsed = extract_scheme_data(scheme)
            if parsed:
                try:
                    insert_scheme(cursor, parsed)
                    if cursor.rowcount > 0:
                        total_inserted += 1
                    else:
                        total_skipped += 1
                except Exception as e:
                    print(f"  Insert error for '{parsed.get('name', 'unknown')}': {e}")
                    total_skipped += 1

        conn.commit()
        print(f"  Committed. Running total: {total_inserted} inserted, {total_skipped} skipped")
        page += 1
        time.sleep(0.5)

    cursor.close()
    conn.close()

    print("\n" + "=" * 60)
    print(f"Import complete!")
    print(f"  Total inserted : {total_inserted}")
    print(f"  Total skipped  : {total_skipped} (duplicates or parse errors)")
    print("=" * 60)

if __name__ == "__main__":
    main()
