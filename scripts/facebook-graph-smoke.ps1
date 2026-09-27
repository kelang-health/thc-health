param(
  [string]$ExpectedPageId = "61583094369573",
  [int]$Limit = 5
)

$ErrorActionPreference = "Stop"

$token = $env:FACEBOOK_USER_ACCESS_TOKEN
$version = $env:FACEBOOK_API_VERSION

if ([string]::IsNullOrWhiteSpace($token)) {
  throw "FACEBOOK_USER_ACCESS_TOKEN is not set. Put the token in an environment variable; do not save it in this repo."
}
if ([string]::IsNullOrWhiteSpace($version)) {
  $version = "v26.0"
}

function Invoke-GraphGet {
  param([string]$Path, [hashtable]$Query)

  $base = "https://graph.facebook.com/$version/$Path"
  $pairs = @()
  foreach ($k in $Query.Keys) {
    $pairs += ([System.Uri]::EscapeDataString($k) + "=" + [System.Uri]::EscapeDataString([string]$Query[$k]))
  }
  $uri = $base + "?" + ($pairs -join "&")
  return Invoke-RestMethod -Method Get -Uri $uri -TimeoutSec 30
}

Write-Host "FB2 smoke test"
Write-Host "Graph API version: $version"
Write-Host "Expected Page ID: $ExpectedPageId"

$accounts = Invoke-GraphGet -Path "me/accounts" -Query @{
  fields = "id,name,tasks,access_token"
  access_token = $token
}

if (-not $accounts.data) {
  throw "No Pages returned from /me/accounts. Check Page access and pages_show_list permission."
}

$page = $accounts.data | Where-Object { $_.id -eq $ExpectedPageId } | Select-Object -First 1
if (-not $page) {
  Write-Host "Pages returned:" -ForegroundColor Yellow
  $accounts.data | Select-Object id,name,tasks | Format-Table -AutoSize
  throw "Expected Page was not returned. Verify the real Page ID and Page access."
}

Write-Host ("Page verified: {0} ({1})" -f $page.name,$page.id) -ForegroundColor Green

$pageToken = $page.access_token
if ([string]::IsNullOrWhiteSpace($pageToken)) {
  throw "Page Access Token was not returned."
}

$posts = Invoke-GraphGet -Path ($page.id + "/posts") -Query @{
  fields = "id,message,created_time,permalink_url,full_picture"
  limit = $Limit
  access_token = $pageToken
}

if (-not $posts.data) {
  Write-Host "Page verified, but no posts were returned." -ForegroundColor Yellow
  exit 0
}

$safe = foreach ($p in $posts.data) {
  $msg = [string]$p.message
  if ($msg.Length -gt 160) { $msg = $msg.Substring(0,160) + "..." }
  [PSCustomObject]@{
    id = $p.id
    created_time = $p.created_time
    message_preview = $msg
    permalink_url = $p.permalink_url
    has_picture = -not [string]::IsNullOrWhiteSpace([string]$p.full_picture)
  }
}

Write-Host ("Posts returned: {0}" -f $safe.Count) -ForegroundColor Green
$safe | Format-Table -Wrap -AutoSize
Write-Host "PASS: Page can be read through Graph API. No access token was printed." -ForegroundColor Green
