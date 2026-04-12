# Scheme Auto-Update Scheduler

Automatically keeps your government schemes database up to date from the [MyScheme API](https://api.myscheme.gov.in).

## What runs and when

| Task | Schedule | Script | What it does |
|------|----------|--------|--------------|
| Daily Update | Every day at **2:00 AM** | `fetch_schemes.py` | Pulls new schemes from API, inserts any that don't already exist (skips duplicates) |
| Weekly Restore | Every **Saturday at 2:00 AM** | `restore_schemes.py` | Wipes all schemes and does a full clean re-import from scratch |

Logs for every run are saved to `ml-service/logs/`.

---

## One-time setup (run once)

### Step 1 — Install Python dependencies (if not already done)

```bash
pip install requests mysql-connector-python python-dotenv
```

### Step 2 — Register the scheduled tasks

Open **PowerShell as Administrator** (right-click PowerShell → Run as administrator), then run:

```powershell
cd "c:\Users\Nochu\gvt checker\Government-eligibility-checker\ml-service"
.\setup_scheduler.ps1
```

That's it. Both tasks are now registered under **Task Scheduler > GovEligibilityChecker**.

---

## Verify the tasks are registered

Open Task Scheduler:
```
Win + R → taskschd.msc → Enter
```
Navigate to: **Task Scheduler Library > GovEligibilityChecker**

You should see:
- `GovEC - Daily Scheme Update`
- `GovEC - Weekly Scheme Restore`

---

## Run manually at any time

**Daily update (new schemes only):**
```bash
cd ml-service
python fetch_schemes.py
```

**Weekly restore (full wipe + re-import):**
```bash
cd ml-service
python restore_schemes.py
```

---

## Logs

All runs write timestamped log files to `ml-service/logs/`:

- `daily_YYYYMMDD_HHMMSS.log` — from daily updates
- `restore_YYYYMMDD_HHMMSS.log` — from weekly restores

---

## Files

```
ml-service/
├── fetch_schemes.py        ← Daily: insert new schemes (INSERT IGNORE)
├── restore_schemes.py      ← Weekly: wipe + full re-import
├── run_daily_update.bat    ← Called by Task Scheduler (daily)
├── run_weekly_restore.bat  ← Called by Task Scheduler (Saturday)
├── setup_scheduler.ps1     ← One-time setup script (run as Admin)
└── logs/                   ← Auto-created, one log file per run
```
