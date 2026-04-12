@echo off
:: Weekly Scheme Restore Runner
:: Runs restore_schemes.py to wipe and fully re-import all schemes
:: Triggered automatically by Windows Task Scheduler every Saturday at 2:00 AM

cd /d "%~dp0"

echo [%date% %time%] Starting weekly scheme restore...

python restore_schemes.py

if %ERRORLEVEL% NEQ 0 (
    echo [%date% %time%] ERROR: restore_schemes.py failed with code %ERRORLEVEL%
    exit /b %ERRORLEVEL%
)

echo [%date% %time%] Weekly restore completed successfully.
