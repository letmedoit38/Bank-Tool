@echo off
title GST Firm Finder - Banker Tool
color 0A

echo ==========================================
echo   GST Firm Finder - Banker Tool
echo ==========================================
echo.

:: Go to the app folder
cd /d "%USERPROFILE%\Bank-Tool"

:: Pull latest updates from GitHub
echo [1/3] Checking for updates...
git pull
echo.

:: Install any new packages
echo [2/3] Checking dependencies...
pip install -r requirements.txt -q
echo.

:: Start the app
echo [3/3] Starting the app...
echo.
echo ==========================================
echo   App is running!
echo   Open your browser and go to:
echo   http://localhost:5000
echo ==========================================
echo.
echo (Close this window to stop the app)
echo.

python app.py

pause
