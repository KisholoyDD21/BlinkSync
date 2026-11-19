@echo off
setlocal
cd /d "%~dp0"

echo ========================================================
echo             BlinkSync Chrome Extension Runner
echo ========================================================
echo [1] Build Extension (Unpacked ready-to-load folder)
echo [2] Dev Mode (Watches files and reloads live)
echo [3] Run Automated Tests (Vitest)
echo [4] Open Built Extension Folder in Explorer
echo [5] Package Extension as ZIP (for Chrome Web Store)
echo ========================================================
set /p choice="Enter choice [default: 1]: "
if "%choice%"=="" set choice=1

if "%choice%"=="1" (
    echo Building Chrome Extension...
    call npm run build
    echo.
    echo ========================================================
    echo Extension built successfully!
    echo Folder: %~dp0.output\chrome-mv3
    echo.
    echo To load into Chrome:
    echo 1. Go to chrome://extensions
    echo 2. Enable "Developer mode" (top right)
    echo 3. Click "Load unpacked" (top left)
    echo 4. Select the folder: %~dp0.output\chrome-mv3
    echo ========================================================
    pause
) else if "%choice%"=="2" (
    echo Starting Extension in Dev Mode (Press Ctrl+C to stop)...
    call npm run dev
) else if "%choice%"=="3" (
    echo Running Vitest...
    call npm test
    pause
) else if "%choice%"=="4" (
    if not exist ".output\chrome-mv3" (
        echo Building extension first...
        call npm run build
    )
    explorer "%~dp0.output\chrome-mv3"
) else if "%choice%"=="5" (
    echo Packaging extension ZIP...
    call npm run zip
    pause
) else (
    echo Invalid choice. Building extension...
    call npm run build
    pause
)

