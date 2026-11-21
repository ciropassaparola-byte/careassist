@echo off
chcp 65001 > nul
title Avvio Progetto Salute

if exist "%~dp0dist\ProgettoSalute-win32-x64\ProgettoSalute.exe" (
    echo Avvio eseguibile Progetto Salute...
    cd /d "%~dp0dist\ProgettoSalute-win32-x64"
    start "" "ProgettoSalute.exe"
    exit
) else (
    echo Avvio Progetto Salute...
    cd /d "%~dp0"
    start "" cmd /c npm start
    exit
)
