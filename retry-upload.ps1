# =============================================================================
#  retry-upload.ps1
#  Re-upload a previously generated video to a specific platform.
#
#  USAGE:
#   .\retry-upload.ps1                                      # TikTok, latest run
#   .\retry-upload.ps1 -Platform youtube                    # YouTube, latest run
#   .\retry-upload.ps1 -Run run-20260405-004301             # TikTok, specific run
#   .\retry-upload.ps1 -Dir .\output\legacy -All            # TikTok, all legacy runs
#   .\retry-upload.ps1 -Platform youtube -Dir .\output -All # YouTube, all runs
# =============================================================================

param(
    [string]$Brand,

    [ValidateSet("tiktok", "youtube")]
    [string]$Platform = "tiktok",

    [string]$Run,
    [string]$Dir,
    [switch]$All
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== Retry Upload ===" -ForegroundColor Cyan
Write-Host "  Platform: $Platform" -ForegroundColor White

$args_ = @("--platform=$Platform")
if ($Brand) { $args_ += "--brand=$Brand" }

if ($Dir) {
    $args_ += "--dir=$Dir"
    Write-Host "  Dir:      $Dir" -ForegroundColor White
}

if ($All) {
    $args_ += "--all"
    Write-Host "  Mode:     all runs" -ForegroundColor Yellow
} elseif ($Run) {
    $args_ += "--run=$Run"
    Write-Host "  Run:      $Run" -ForegroundColor White
} else {
    Write-Host "  Run:      (latest)" -ForegroundColor DarkGray
}

Write-Host ""

npx tsx src/retry-upload.ts @args_
