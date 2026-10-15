@echo off
title ATK Transportes - Instalador Automatico de Telemetria
chcp 65001 >nul
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalar_plugin_telemetria.ps1"

echo.
pause
