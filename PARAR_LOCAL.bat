@echo off
chcp 65001 >nul
title Paracolor - Parar teste local
cd /d "%~dp0"
docker compose --env-file .env.local -f docker-compose.local.yml down
if errorlevel 1 (
  echo Nao foi possivel parar os containers. Verifique se o Docker Desktop esta aberto.
  pause
) else (
  echo Sistema parado. Banco e arquivos locais foram preservados.
  pause
)
