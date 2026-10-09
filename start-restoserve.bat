@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install the current Node.js LTS version, then reopen this file.
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Reinstall Node.js LTS and make sure npm is included.
  pause
  exit /b 1
)

if not exist "node_modules\wrangler\bin\wrangler.js" (
  echo First-time setup: installing RestoServe's local runtime. Internet is needed once.
  call npm ci
  if errorlevel 1 goto failed
)

set CI=1
echo Preparing this PC's local database. It does not connect to the hosted site.
call npm run db:local
if errorlevel 1 goto failed

echo.
echo RestoServe is starting. When Wrangler prints its local URL, open http://localhost:8787 in your browser.
echo Keep this window open while using RestoServe. Press Ctrl+C to stop it.
call npm run dev
if errorlevel 1 goto failed
exit /b 0

:failed
echo.
echo RestoServe could not start. Check the message above, then try again.
pause
exit /b 1
