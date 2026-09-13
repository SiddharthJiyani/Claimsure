@echo off
echo ===================================================
echo   Starting Claimsure AI Server on http://localhost:8000
echo ===================================================
cd /d "%~dp0"
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
pause
