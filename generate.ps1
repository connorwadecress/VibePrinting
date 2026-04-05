param(
    [string]$Brand,

    [string]$Lane,

    [switch]$DryRun,

    [switch]$Upload
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "`n=== Vibe Printing - Video Generator ===" -ForegroundColor Cyan
Write-Host ""

# Build args — NOTE: $args is reserved in PowerShell, use $tsArgs instead
$tsArgs = @()
if ($Brand)  { $tsArgs += "--brand=$Brand" }
if ($Lane)   { $tsArgs += "--lane=$Lane" }
if ($DryRun) { $tsArgs += "--dry-run" }
if ($Upload) { $tsArgs += "--upload" }

$argDisplay = if ($tsArgs.Count -gt 0) { $tsArgs -join " " } else { "(default - random lane, full pipeline)" }
Write-Host "Options: $argDisplay" -ForegroundColor DarkGray
Write-Host ""

# Run pipeline
npx tsx src/generate.ts @tsArgs

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nDone!" -ForegroundColor Green
} else {
    Write-Host "`nGeneration failed." -ForegroundColor Red
    exit 1
}
