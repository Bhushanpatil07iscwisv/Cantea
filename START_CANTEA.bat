@echo off
setlocal
cd /d "%~dp0"
title Cantea
if exist ".venv\Scripts\python.exe" (
  ".venv\Scripts\python.exe" launcher.py %*
  goto done
)
py -3 -c "import sys; assert sys.version_info >= (3,10)" >nul 2>&1
if not errorlevel 1 (
  py -3 launcher.py %*
  goto done
)
python -c "import sys; assert sys.version_info >= (3,10)" >nul 2>&1
if not errorlevel 1 (
  python launcher.py %*
  goto done
)
for /d %%D in ("%LocalAppData%\Programs\Python\Python*") do (
  if exist "%%~fD\python.exe" (
    "%%~fD\python.exe" launcher.py %*
    goto done
  )
)
echo Python was not found. Install Python 3.12 or 3.13 and enable Add Python to PATH.
echo Then double-click START_CANTEA.bat again.
:done
pause
