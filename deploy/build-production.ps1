$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root "dist-production"
if (Test-Path $out) { Remove-Item $out -Recurse -Force }
New-Item -ItemType Directory -Path $out | Out-Null

@(
  "index.html","styles.css","app.js",
  "admin.html","admin.css","admin.js"
) | ForEach-Object {
  Copy-Item (Join-Path $root $_) (Join-Path $out $_)
}

Copy-Item (Join-Path $root "site.config.production.js") (Join-Path $out "site.config.js")

@(
  "User-agent: *",
  "Allow: /"
) | Set-Content -Encoding ASCII (Join-Path $out "robots.txt")

@(
  "/*",
  "  X-Content-Type-Options: nosniff",
  "  Referrer-Policy: strict-origin-when-cross-origin",
  "  Permissions-Policy: camera=(), microphone=(), geolocation=()",
  "  Content-Security-Policy: default-src 'self'; connect-src 'self' https://txjuiaiwffsxfcrxpkvd.supabase.co; img-src 'self' https://kelang-health.github.io data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  "/admin*",
  "  X-Robots-Tag: noindex, nofollow"
) | Set-Content -Encoding ASCII (Join-Path $out "_headers")

Write-Output "THC Health production build ready: $out"