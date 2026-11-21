@echo off
chcp 65001 > nul
title MedNutri Pro - Ambulatorio Portatile

set "DATA_DIR=%~dp0Dati_Clinici_USB"
if not exist "%DATA_DIR%" mkdir "%DATA_DIR%"

set "HTML_FILE=%~dp0index.html"

:: 1. Ricerca Microsoft Edge (presente su Windows 10 e 11)
set "BROWSER_EXE="
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "BROWSER_EXE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER_EXE if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "BROWSER_EXE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER_EXE if exist "%LocalAppData%\Microsoft\Edge\Application\msedge.exe" set "BROWSER_EXE=%LocalAppData%\Microsoft\Edge\Application\msedge.exe"

:: 2. Ricerca Google Chrome come alternativa
if not defined BROWSER_EXE if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "BROWSER_EXE=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER_EXE if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "BROWSER_EXE=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER_EXE if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "BROWSER_EXE=%LocalAppData%\Google\Chrome\Application\chrome.exe"

:: 3. Avvio in modalita App Desktop senza barre del browser con profilo USB isolato
if defined BROWSER_EXE (
    start "" "%BROWSER_EXE%" --app="file:///%HTML_FILE:\=/%" --user-data-dir="%DATA_DIR%" --no-first-run --no-default-browser-check
) else (
    start "" "%HTML_FILE%"
)
exit
