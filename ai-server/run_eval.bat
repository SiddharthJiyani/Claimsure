@echo off
echo ===================================================
echo   Running Claimsure 20-Case Evaluation Harness
echo ===================================================
cd /d "%~dp0"
python -m eval.harness
pause
