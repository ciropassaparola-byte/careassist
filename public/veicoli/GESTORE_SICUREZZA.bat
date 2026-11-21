@echo off
title ZENITH GUARDIAN
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERRORE] Esegui come AMMINISTRATORE!
    pause
    exit
)
start "" "%~dp0system\Guardian.exe"
exit
