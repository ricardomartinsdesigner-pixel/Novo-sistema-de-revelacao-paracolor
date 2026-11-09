@echo off
setlocal
cd /d "%~dp0"
docker compose --profile public ps
echo.
echo Para ver os registros da aplicacao, abra o PowerShell nesta pasta e execute:
echo docker compose logs --tail=100 app
pause
endlocal
