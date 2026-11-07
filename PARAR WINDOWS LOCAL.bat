@echo off
chcp 65001 >nul
title Paracolor - Parar servidor local
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0parar-windows-nativo.ps1"
pause
