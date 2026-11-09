@echo off
setlocal
cd /d "%~dp0"
title Iniciar Paracolor

if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo O arquivo .env foi criado.
  echo Preencha APP_DOMAIN, POSTGRES_PASSWORD, SESSION_SECRET e os dados do administrador.
  echo Para publicar pela Cloudflare, preencha tambem CLOUDFLARE_TUNNEL_TOKEN.
  start "" notepad.exe ".env"
  echo.
  echo Salve o arquivo .env e execute INICIAR_PARACOLOR.bat novamente.
  pause
  exit /b 0
)

docker info >nul 2>&1
if errorlevel 1 (
  echo O Docker Desktop nao esta iniciado.
  echo Abra o Docker Desktop, aguarde ele ficar pronto e execute este arquivo novamente.
  pause
  exit /b 1
)

findstr /R /C:"^CLOUDFLARE_TUNNEL_TOKEN=.[^ ]*" .env >nul
if errorlevel 1 (
  echo Iniciando o Paracolor somente neste computador...
  docker compose up -d --build
) else (
  echo Iniciando o Paracolor e o tunel Cloudflare...
  docker compose --profile public up -d --build
)

if errorlevel 1 (
  echo.
  echo Ocorreu um erro. Confira o Docker Desktop e os campos do arquivo .env.
  pause
  exit /b 1
)

echo.
echo Servicos iniciados. O computador pode demorar alguns minutos na primeira vez.
echo Para conferir o estado, execute STATUS_PARACOLOR.bat.
echo Site local: http://localhost:3000
pause
endlocal
