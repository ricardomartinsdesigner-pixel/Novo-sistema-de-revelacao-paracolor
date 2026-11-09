@echo off
setlocal
cd /d "%~dp0"
docker compose --profile public stop
echo.
echo Paracolor parado. Banco e arquivos foram preservados.
pause
endlocal
