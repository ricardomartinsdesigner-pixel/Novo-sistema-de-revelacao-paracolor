@echo off
chcp 65001 >nul
title Paracolor - Inicializador local
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0iniciar-local.ps1"
if errorlevel 1 (
  echo.
  echo O sistema nao iniciou. Leia a mensagem acima.
  pause
)
