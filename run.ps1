# BlinkSync Chrome Extension Runner Script
[CmdletBinding()]
param(
    [ValidateSet('build', 'dev', 'test', 'open', 'zip')]
    [string]$Action
)

$PSScriptRootLocation = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $PSScriptRootLocation

if (-not $Action) {
    Write-Host "========================================================" -ForegroundColor Cyan
    Write-Host "           BlinkSync Chrome Extension Runner            " -ForegroundColor Green
    Write-Host "========================================================" -ForegroundColor Cyan
    Write-Host "1) Build Extension (generates pure unpacked folder)"
    Write-Host "2) Start Dev Mode (auto-reload on edits)"
    Write-Host "3) Run Automated Tests (vitest)"
    Write-Host "4) Open Built Extension Folder in Windows Explorer"
    Write-Host "5) Package Extension as ZIP (for Chrome Web Store)"
    Write-Host "========================================================" -ForegroundColor Cyan
    $choice = Read-Host "Choose an option (1-5) [default: 1]"
    if ([string]::IsNullOrWhiteSpace($choice)) { $choice = "1" }

    switch ($choice) {
        "1" { $Action = "build" }
        "2" { $Action = "dev" }
        "3" { $Action = "test" }
        "4" { $Action = "open" }
        "5" { $Action = "zip" }
        default { $Action = "build" }
    }
}

$outputDir = Join-Path $PSScriptRootLocation ".output\chrome-mv3"

switch ($Action) {
    "build" {
        Write-Host "Building BlinkSync Chrome Extension..." -ForegroundColor Green
        npm run build
        Write-Host "`nExtension built successfully!" -ForegroundColor Green
        Write-Host "Folder to load: $outputDir" -ForegroundColor Yellow
        Write-Host "`nTo load into Chrome:" -ForegroundColor Cyan
        Write-Host "1. Navigate to chrome://extensions"
        Write-Host "2. Enable 'Developer mode' (top-right)"
        Write-Host "3. Click 'Load unpacked' and select: $outputDir`n"
    }
    "dev" {
        Write-Host "Starting Dev Mode (watching files)..." -ForegroundColor Green
        npm run dev
    }
    "test" {
        Write-Host "Running vitest tests..." -ForegroundColor Green
        npm test
    }
    "open" {
        if (-not (Test-Path $outputDir)) {
            Write-Host "Extension not built yet. Building now..." -ForegroundColor Yellow
            npm run build
        }
        Write-Host "Opening $outputDir in Explorer..." -ForegroundColor Green
        Invoke-Item $outputDir
    }
    "zip" {
        Write-Host "Packaging extension ZIP for Chrome Web Store..." -ForegroundColor Green
        npm run zip
    }
}

