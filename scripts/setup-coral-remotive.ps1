# Installs the Remotive community source into your local Coral instance.
# Prerequisites: Coral CLI installed — https://withcoral.com/docs

$manifest = Join-Path $PSScriptRoot "..\coral\remotive.manifest.yaml"
$manifest = Resolve-Path $manifest

if (-not (Get-Command coral -ErrorAction SilentlyContinue)) {
  Write-Host "Coral CLI not found. Install from https://withcoral.com/docs/getting-started/installation"
  Write-Host "  Windows: download coral-x86_64-pc-windows-msvc.zip and add coral.exe to PATH"
  exit 1
}

Write-Host "Adding Remotive community source from $manifest"
coral source add --file $manifest

Write-Host "Testing connectivity..."
coral sql "SELECT id, title, company_name, category FROM remotive.jobs LIMIT 1"

Write-Host "Done. The app runs queries via: coral sql (no separate server needed)."
Write-Host "Optional: coral ui  # browser SQL UI on http://127.0.0.1:1457"
