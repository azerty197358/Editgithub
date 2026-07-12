@echo off
echo ======================================
echo    My AI Assistant - Setup & Run
echo ======================================
echo.

echo [1/3] Installing required libraries...
pip install openhands-sdk openhands-tools

echo.
echo [2/3] Libraries installed!
echo.

echo [3/3] Starting Assistant...
echo.
python assistant.py

pause
