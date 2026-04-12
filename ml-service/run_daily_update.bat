@echo off
:: Daily Scheme Update Runner
:: Runs fetch_schemes.py to pull new schemes from the MyScheme API
:: Triggered automatically by Windows Task Scheduler at 2:00 AM daily

cd /d "%~dp0"

echo [%date% %time%] Starting daily scheme update...

python fetch_schemes.py

if %ERRORLEVEL% NEQ 0 (
    echo [%date% %time%] ERROR: fetch_schemes.py failed with code %ERRORLEVEL%
    exit /b %ERRORLEVEL%
)

echo [%date% %time%] Daily update completed successfully.
