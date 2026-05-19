@echo off
setlocal
cd /d "%~dp0"

node tests\sql-rpc-regression.test.js || exit /b 1
node tests\ui-consistency.test.js || exit /b 1
node tests\repo-policy.test.js || exit /b 1
node tests\sw-cache.test.js || exit /b 1
node --check js\config.js || exit /b 1
node --check js\db.js || exit /b 1
node --check js\app.js || exit /b 1
node --check js\therapist.js || exit /b 1
node --check sw.js || exit /b 1
