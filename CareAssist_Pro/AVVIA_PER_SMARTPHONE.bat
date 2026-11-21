@echo off
title CareAssist Pro - Server Smartphone ^& Tablet (Wi-Fi)
color 0B
cd /d "%~dp0"
echo ====================================================================
echo   🩺 CAREASSIST PRO - AVVIO CONNESSIONE SMARTPHONE / TABLET
echo ====================================================================
echo.
echo Avvio del server locale in corso...
node server_smartphone.js
pause
