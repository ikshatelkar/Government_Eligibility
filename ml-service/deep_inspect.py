"""
Deep inspection of __NEXT_DATA__ structure on a scheme page.
"""
import requests, json, mysql.connector, os
from bs4 import BeautifulSoup
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'backend', '.env'))

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

conn = mysql.connector.connect(
    host=os.getenv('DB_HOST', 'localhost'),
    user=os.getenv('DB_USER'),
    password=os.getenv('DB_PASSWORD'),
    database=os.getenv('DB_NAME'),
)
cursor = conn.cursor()
cursor.execute("SELECT external_id FROM programs WHERE external_id IS NOT NULL LIMIT 1")
slug = cursor.fetchone()[0]
cursor.close()
conn.close()

url = f"https://www.myscheme.gov.in/schemes/{slug}"
print(f"Fetching: {url}")
r = requests.get(url, headers=HEADERS, timeout=15)
print(f"Status: {r.status_code}")
soup = BeautifulSoup(r.text, "html.parser")
script = soup.find("script", {"id": "__NEXT_DATA__"})
if script:
    data = json.loads(script.string)
    props = data.get("props", {}).get("pageProps", {})
    print(f"pageProps keys: {list(props.keys())}")
    # Print full structure (truncated)
    print(json.dumps(props, indent=2)[:4000])
else:
    print("No __NEXT_DATA__ found")
    # Check what scripts are present
    scripts = soup.find_all("script")
    print(f"Scripts found: {len(scripts)}")
    for s in scripts[:5]:
        print(f"  id={s.get('id')} src={s.get('src')} len={len(s.string or '')}")
