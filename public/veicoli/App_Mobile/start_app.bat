@echo off
title MOBILE_BRIDGE_CLI
echo [BENVENUTO] Avvio Ponte Mobile in modalita' CLI...
echo.
cd /d "%~dp0"

echo [*] Pulizia processi esistenti...
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im cloudflared.exe >nul 2>&1

echo [*] Avvio Log...
echo > tunnel_log.txt

echo [*] Avvio Tunnel Cloudflare (Porta 3002)...
start "TUNNEL" /min cmd /c "cloudflared.exe tunnel --url http://localhost:3002 > tunnel_log.txt 2>&1"

echo [*] Avvio Server Node.js...
cd server
if exist "..\bin\node.exe" (
    ..\bin\node.exe db_bridge.js
) else (
    node db_bridge.js
)
