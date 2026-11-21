@echo off
title SINCRONIZZAZIONE INTELLIGENTE BIDIREZIONALE: USB <-> WEB CLOUD
chcp 65001 >nul
color 0A

echo ================================================================================
echo    âœ¦ SUITE AZIENDALE C. MILELLA - FUSIONE INTELLIGENTE DATI (NO PERDITA) âœ¦
echo ================================================================================
echo.
echo  Questo strumento esegue la FUSIONE BIDIREZIONALE (Merge Intelligente):
echo   1. Scarica le novita registrate online dal Cellulare
echo   2. Raccoglie le modifiche fatte offline dal PC sulla Chiavetta USB
echo   3. Unisce cronologia farmaci, pazienti, inventario e note senza sovrascritture
echo   4. Aggiorna sia la Chiavetta USB che il Web Cloud contemporaneamente
echo.
echo ================================================================================
echo.

set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

cd /d "%SCRIPT_DIR%"

if not exist "%SCRIPT_DIR%\sincronizzazione_intelligente.js" (
    echo [ERRORE] Script sincronizzazione_intelligente.js non trovato!
    pause
    exit /b
)

node "%SCRIPT_DIR%\sincronizzazione_intelligente.js"

echo.
pause
