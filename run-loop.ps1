param(
    [string]$Brand,
    [int]$IntervalMinutes = 20,
    [int]$RunsMax = 0  # 0 = unlimited until you Ctrl+C
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$runCount = 0

Write-Host "`n=== Vibe Printing - Auto Loop ===" -ForegroundColor Cyan
Write-Host "Interval : every $IntervalMinutes minutes" -ForegroundColor DarkGray
Write-Host "Max runs : $(if ($RunsMax -gt 0) { $RunsMax } else { 'unlimited (Ctrl+C to stop)' })" -ForegroundColor DarkGray
Write-Host ""

while ($true) {
    $runCount++
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

    Write-Host "[$timestamp] Starting run #$runCount..." -ForegroundColor Green

    try {
        $loopArgs = @("--upload")
        if ($Brand) { $loopArgs += "--brand=$Brand" }
        npx tsx src/generate.ts @loopArgs
        Write-Host "[$timestamp] Run #$runCount complete." -ForegroundColor Green
    } catch {
        Write-Host "[$timestamp] Run #$runCount FAILED: $_" -ForegroundColor Red
        Write-Host "Continuing to next run..." -ForegroundColor Yellow
    }

    if ($RunsMax -gt 0 -and $runCount -ge $RunsMax) {
        Write-Host "`nReached max runs ($RunsMax). Exiting." -ForegroundColor Cyan
        break
    }

    $nextRun = (Get-Date).AddMinutes($IntervalMinutes).ToString("HH:mm:ss")
    Write-Host "Next run at $nextRun. Waiting $IntervalMinutes minutes..." -ForegroundColor DarkGray
    Write-Host ""

    Start-Sleep -Seconds ($IntervalMinutes * 60)
}
