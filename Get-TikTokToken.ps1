# ============================================================
#  Get-TikTokToken.ps1
#  Run this ONCE to generate your TikTok OAuth tokens.
#
#  PREREQUISITES:
#   1. TikTok Developer Portal app with "Content Posting API" added.
#   2. Scope "video.publish" enabled under Content Posting API.
#   3. Redirect URI "http://localhost" added under your app's settings.
#      (Add it in: App Details -> Basic information -> Redirect URI)
#
#  USAGE:
#   .\Get-TikTokToken.ps1 -ClientKey <key> -ClientSecret <secret>
#
#  OUTPUT:
#   Prints TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, TIKTOK_ACCESS_TOKEN,
#   and TIKTOK_REFRESH_TOKEN — paste all four into your .env file.
# ============================================================

param(
    [Parameter(Mandatory)]
    [string]$ClientKey,

    [Parameter(Mandatory)]
    [string]$ClientSecret
)

$ErrorActionPreference = "Stop"

Write-Host "`n=== SignalDrop - TikTok OAuth Setup ===" -ForegroundColor Cyan
Write-Host ""

# ── PKCE helpers ──────────────────────────────────────────────────────────────

function New-CodeVerifier {
    $bytes = New-Object Byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function Get-CodeChallenge([string]$verifier) {
    $sha256    = [System.Security.Cryptography.SHA256]::Create()
    $hashBytes = $sha256.ComputeHash([System.Text.Encoding]::ASCII.GetBytes($verifier))
    return [Convert]::ToBase64String($hashBytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function New-State {
    $bytes = New-Object Byte[] 16
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

# ── Find a free port ──────────────────────────────────────────────────────────

$listener = [System.Net.HttpListener]::new()
$port = 49200
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

$redirectUri = "http://localhost:$port"
Write-Host "Callback listener started on $redirectUri" -ForegroundColor DarkGray
Write-Host ""
Write-Host "IMPORTANT: Make sure '$redirectUri' is added as a Redirect URI" -ForegroundColor Yellow
Write-Host "in your TikTok Developer Portal under App Details -> Basic Information." -ForegroundColor Yellow
Write-Host ""

# ── Build PKCE values & auth URL ─────────────────────────────────────────────

$codeVerifier  = New-CodeVerifier
$codeChallenge = Get-CodeChallenge $codeVerifier
$state         = New-State

$scope    = "user.info.basic,video.publish"  # Login Kit + Content Posting API (Direct Post)
$authUrl  = "https://www.tiktok.com/v2/auth/authorize/" +
            "?client_key=$([Uri]::EscapeDataString($ClientKey))" +
            "&redirect_uri=$([Uri]::EscapeDataString($redirectUri))" +
            "&response_type=code" +
            "&scope=$([Uri]::EscapeDataString($scope))" +
            "&state=$([Uri]::EscapeDataString($state))" +
            "&code_challenge=$([Uri]::EscapeDataString($codeChallenge))" +
            "&code_challenge_method=S256"

Write-Host "Opening TikTok authorisation page..." -ForegroundColor Yellow
Write-Host "Log in as the SignalDrop TikTok account and tap 'Authorise'." -ForegroundColor Green
Write-Host ""
Start-Process $authUrl

# ── Wait for TikTok redirect ──────────────────────────────────────────────────

Write-Host "Waiting for TikTok to redirect back..." -ForegroundColor DarkGray
$context  = $listener.GetContext()
$request  = $context.Request
$authCode = $request.QueryString["code"]
$authErr  = $request.QueryString["error"]
$retState = $request.QueryString["state"]

# Respond to the browser tab
$html = if ($authCode) {
    "<html><body style='font-family:sans-serif;padding:40px;background:#010101;color:#fff'>" +
    "<h2 style='color:#69c9d0'>SignalDrop TikTok connected!</h2>" +
    "<p>You can close this tab and return to PowerShell.</p></body></html>"
} else {
    "<html><body style='font-family:sans-serif;padding:40px'>" +
    "<h2>Something went wrong</h2><p>Error: $authErr</p></body></html>"
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

# Verify state to protect against CSRF
if ($retState -ne $state) {
    Write-Host "`nState mismatch — possible CSRF attack. Aborting." -ForegroundColor Red
    exit 1
}

Write-Host "Auth code received." -ForegroundColor Green

# ── Exchange auth code for tokens ─────────────────────────────────────────────

Write-Host "Exchanging for access + refresh tokens..." -ForegroundColor Yellow

$body = "client_key=$([Uri]::EscapeDataString($ClientKey))" +
        "&client_secret=$([Uri]::EscapeDataString($ClientSecret))" +
        "&code=$([Uri]::EscapeDataString($authCode))" +
        "&grant_type=authorization_code" +
        "&redirect_uri=$([Uri]::EscapeDataString($redirectUri))" +
        "&code_verifier=$([Uri]::EscapeDataString($codeVerifier))"

try {
    $response = Invoke-RestMethod `
        -Uri "https://open.tiktokapis.com/v2/oauth/token/" `
        -Method Post `
        -ContentType "application/x-www-form-urlencoded" `
        -Body $body

    $accessToken  = $response.access_token
    $refreshToken = $response.refresh_token
    $expiresIn    = $response.expires_in

    if (-not $accessToken) {
        Write-Host "`nNo access token returned. Response:" -ForegroundColor Red
        Write-Host ($response | ConvertTo-Json) -ForegroundColor DarkGray
        exit 1
    }

    Write-Host "`n=== SUCCESS ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "Access token expires in: $expiresIn seconds (~$([Math]::Round($expiresIn/3600, 1)) hours)" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "Copy these into your .env file:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "TIKTOK_CLIENT_KEY=$ClientKey"         -ForegroundColor White
    Write-Host "TIKTOK_CLIENT_SECRET=$ClientSecret"   -ForegroundColor White
    Write-Host "TIKTOK_ACCESS_TOKEN=$accessToken"     -ForegroundColor White
    Write-Host "TIKTOK_REFRESH_TOKEN=$refreshToken"   -ForegroundColor White
    Write-Host ""
    Write-Host "NOTE: TikTok access tokens expire after ~24 hours." -ForegroundColor Yellow
    Write-Host "The pipeline will auto-refresh using TIKTOK_REFRESH_TOKEN." -ForegroundColor Yellow
    Write-Host "When the refresh token rotates, re-run this script to get new ones." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Then post to SignalDrop with: .\generate.ps1 -Upload" -ForegroundColor Green
    Write-Host ""

} catch {
    Write-Host "`nToken exchange failed: $_" -ForegroundColor Red

    # Surface the raw response body if available
    if ($_.Exception.Response) {
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        Write-Host "Response body: $($reader.ReadToEnd())" -ForegroundColor DarkGray
    }
    exit 1
}
