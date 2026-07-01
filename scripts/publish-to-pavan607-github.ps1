# Publish QMS CABS to https://github.com/pavan607/QMS-CABS
# Prerequisite: GitHub CLI logged in as pavan607 (gh auth login)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

$status = gh auth status 2>&1 | Out-String
if ($status -notmatch "account pavan607") {
    Write-Host "Log in as pavan607 first:" -ForegroundColor Yellow
    gh auth login --hostname github.com --git-protocol https --web
    $status = gh auth status 2>&1 | Out-String
    if ($status -notmatch "account pavan607") {
        throw "Still not logged in as pavan607. Run: gh auth login"
    }
}

$view = gh repo view pavan607/QMS-CABS 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) {
    Write-Host "Creating pavan607/QMS-CABS ..."
    gh repo create pavan607/QMS-CABS --public --description "QMS CABS"
}

git remote set-url origin https://github.com/pavan607/QMS-CABS.git
git push -u origin main
Write-Host "Done: https://github.com/pavan607/QMS-CABS" -ForegroundColor Green
