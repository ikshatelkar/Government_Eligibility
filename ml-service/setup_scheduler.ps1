# setup_scheduler.ps1
# Registers two Windows Task Scheduler tasks for automatic scheme updates:
#   1. Daily at 2:00 AM   — runs fetch_schemes.py  (new schemes only)
#   2. Saturday at 2:00 AM — runs restore_schemes.py (full wipe + re-import)
#
# Run this script ONCE as Administrator:
#   Right-click PowerShell > "Run as administrator"
#   Then: cd "c:\Users\Nochu\gvt checker\Government-eligibility-checker\ml-service"
#         .\setup_scheduler.ps1

$mlServiceDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$dailyBat     = Join-Path $mlServiceDir "run_daily_update.bat"
$weeklyBat    = Join-Path $mlServiceDir "run_weekly_restore.bat"

# ── Validate files exist ──────────────────────────────────────────────────────
foreach ($f in @($dailyBat, $weeklyBat)) {
    if (-not (Test-Path $f)) {
        Write-Error "Required file not found: $f"
        exit 1
    }
}

# ── Helper: create or overwrite a task ───────────────────────────────────────
function Register-SchemeTask {
    param(
        [string]$TaskName,
        [string]$BatFile,
        [string]$TriggerDescription,
        [object]$Trigger
    )

    $action  = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$BatFile`"" -WorkingDirectory $mlServiceDir
    $settings = New-ScheduledTaskSettingsSet `
        -ExecutionTimeLimit (New-TimeSpan -Hours 2) `
        -StartWhenAvailable `
        -RunOnlyIfNetworkAvailable

    # Remove existing task if it exists
    if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "  Removed existing task: $TaskName"
    }

    Register-ScheduledTask `
        -TaskName    $TaskName `
        -TaskPath    "\GovEligibilityChecker\" `
        -Action      $action `
        -Trigger     $Trigger `
        -Settings    $settings `
        -RunLevel    Highest `
        -Description $TriggerDescription | Out-Null

    Write-Host "  Registered: $TaskName  ($TriggerDescription)" -ForegroundColor Green
}

# ── Task 1: Daily at 2:00 AM (Mon–Fri, and also runs when missed) ─────────────
Write-Host "`nSetting up DAILY scheme update task..."
$dailyTrigger = New-ScheduledTaskTrigger -Daily -At "02:00"
Register-SchemeTask `
    -TaskName           "GovEC - Daily Scheme Update" `
    -BatFile            $dailyBat `
    -TriggerDescription "Runs fetch_schemes.py every day at 02:00 AM" `
    -Trigger            $dailyTrigger

# ── Task 2: Weekly on Saturday at 2:00 AM ────────────────────────────────────
Write-Host "`nSetting up WEEKLY restore task..."
$weeklyTrigger = New-ScheduledTaskTrigger -Weekly -WeeksInterval 1 -DaysOfWeek Saturday -At "02:00"
Register-SchemeTask `
    -TaskName           "GovEC - Weekly Scheme Restore" `
    -BatFile            $weeklyBat `
    -TriggerDescription "Runs restore_schemes.py every Saturday at 02:00 AM (full re-import)" `
    -Trigger            $weeklyTrigger

# ── Summary ──────────────────────────────────────────────────────────────────
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host " Task Scheduler setup complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host " Tasks registered under: Task Scheduler > GovEligibilityChecker"
Write-Host ""
Write-Host " DAILY UPDATE   : Every day at 02:00 AM"
Write-Host "   Script       : $dailyBat"
Write-Host ""
Write-Host " WEEKLY RESTORE : Every Saturday at 02:00 AM"
Write-Host "   Script       : $weeklyBat"
Write-Host ""
Write-Host " Logs are saved to: $mlServiceDir\logs\"
Write-Host ""
Write-Host " To verify in Task Scheduler:"
Write-Host "   taskschd.msc > Task Scheduler Library > GovEligibilityChecker"
Write-Host ""
