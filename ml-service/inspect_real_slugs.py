"""
Inspect real scheme slugs from our DB to see the eligibility structure.
"""
import requests, json, mysql.connector, os
from bs4 import BeautifulSoup
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'backend', '.env'))

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

# Get a few real slugs from DB
conn = mysql.connector.connect(
    host=os.getenv('DB_HOST', 'localhost'),
    user=os.getenv('DB_USER'),
    password=os.getenv('DB_PASSWORD'),
    database=os.getenv('DB_NAME'),
)
cursor = conn.cursor()
cursor.execute("SELECT external_id, name, category FROM programs WHERE external_id IS NOT NULL LIMIT 5")
rows = cursor.fetchall()
cursor.close()
conn.close()

for slug, name, cat in rows:
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

    print(f"\n{'='*60}")
    print(f"SCHEME: {name} [{cat}]")
    print(f"TOP KEYS in schemeData.en: {list(sd.keys())}")

    # Print eligibility section fully
    elig = sd.get("eligibilityCriteria", {})
    print(f"eligibilityCriteria: {json.dumps(elig, indent=2)[:1500]}")

    # Also check if there's a separate eligibility list
    for key in sd.keys():
        if 'elig' in key.lower() or 'criteria' in key.lower() or 'target' in key.lower() or 'benefic' in key.lower():
            print(f"  KEY '{key}': {json.dumps(sd[key])[:400]}")
