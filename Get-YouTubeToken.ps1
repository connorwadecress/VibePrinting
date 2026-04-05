# ============================================================
#  Get-YouTubeToken.ps1
#  Run this ONCE to generate your YouTube OAuth refresh token.
#
#  REQUIRES a "Desktop app" OAuth credential from Google Cloud Console.
#  (APIs & Services -> Credentials -> + Create Credentials -> OAuth 2.0
#   Client ID -> Desktop app). No redirect URI setup needed for Desktop type.
# ============================================================

param(
    [Parameter(Mandatory)]
    [string]$ClientId,

    [Parameter(Mandatory)]
    [string]$ClientSecret
)

$ErrorActionPreference = "Stop"
$scope = "https://www.googleapis.com/auth/youtube.upload"

Write-Host "`n=== Vibe Printing - YouTube OAuth Setup ===" -ForegroundColor Cyan
Write-Host ""

# Find a free port dynamically — no more port conflicts
$listener = [System.Net.HttpListener]::new()
$port = 49152
while ($port -le 65535) {
    try {
        $listener.Prefixes.Clear()
        $listener.Prefixes.Add("http://localhost:$port/")
        $listener.Start()
        break
    } catch {
        $port++
    }
}
$redirect = "http://localhost:$port"
Write-Host "Listening on $redirect" -ForegroundColor DarkGray

# Build auth URL — prompt=select_account lets you pick the correct account
$authUrl = "https://accounts.google.com/o/oauth2/v2/auth" +
           "?client_id=$([Uri]::EscapeDataString($ClientId))" +
           "&redirect_uri=$([Uri]::EscapeDataString($redirect))" +
           "&response_type=code" +
           "&scope=$([Uri]::EscapeDataString($scope))" +
           "&access_type=offline" +
           "&prompt=select_account%20consent"

# Open browser
Write-Host "Opening Google account picker..." -ForegroundColor Yellow
Write-Host "Select your channel's Google account`n" -ForegroundColor Green
Start-Process $authUrl

# Wait for Google to redirect back
Write-Host "Waiting for Google redirect..." -ForegroundColor DarkGray
$context  = $listener.GetContext()
$request  = $context.Request
$authCode = $request.QueryString["code"]
$authErr  = $request.QueryString["error"]

# Respond to the browser
$html = if ($authCode) {
    "<html><body style='font-family:sans-serif;padding:40px;background:#0f0f0f;color:#fff'><h2 style='color:#00c9a7'>YouTube connected!</h2><p>You can close this tab and go back to PowerShell.</p></body></html>"
} else {
    "<html><body style='font-family:sans-serif;padding:40px'><h2>Something went wrong</h2><p>Error: $authErr</p></body></html>"
}
$buffer = [System.Text.Encoding]::UTF8.GetBytes($html)
$context.Response.ContentLength64 = $buffer.Length
$context.Response.OutputStream.Write($buffer, 0, $buffer.Length)
$context.Response.OutputStream.Close()
$listener.Stop()

if ($authErr -or -not $authCode) {
    Write-Host "`nAuth failed: $authErr" -ForegroundColor Red
    exit 1
}

Write-Host "Auth code received." -ForegroundColor Green

# Exchange code for tokens
Write-Host "Exchanging for refresh token..." -ForegroundColor Yellow

$body = @{
    code          = $authCode
    client_id     = $ClientId
    client_secret = $ClientSecret
    redirect_uri  = $redirect
    grant_type    = "authorization_code"
}

try {
    $token = Invoke-RestMethod `
        -Uri "https://oauth2.googleapis.com/token" `
        -Method Post `
        -Body $body

    $refreshToken = $token.refresh_token

    if (-not $refreshToken) {
        Write-Host "`nNo refresh token returned." -ForegroundColor Red
        Write-Host "Revoke access at https://myaccount.google.com/permissions and run again." -ForegroundColor Yellow
        exit 1
    }

    Write-Host "`n=== SUCCESS ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "Copy these into your .env file:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "YOUTUBE_CLIENT_ID=$ClientId"         -ForegroundColor White
    Write-Host "YOUTUBE_CLIENT_SECRET=$ClientSecret" -ForegroundColor White
    Write-Host "YOUTUBE_REFRESH_TOKEN=$refreshToken" -ForegroundColor White
    Write-Host ""
    Write-Host "Then upload with: .\generate.ps1 -Brand <your-brand> -Upload" -ForegroundColor Green
    Write-Host ""

} catch {
    Write-Host "`nToken exchange failed: $_" -ForegroundColor Red
    exit 1
}
