@echo off
setlocal enabledelayedexpansion
title RIPARAZIONE PONTE MOBILE - SISTEMA LOGISTICA C. MILELLA
color 0E

echo ============================================================
echo      STRUMENTO DI RIPARAZIONE E TEST PONTE MOBILE
echo ============================================================
echo.

:: 1. Privilegi Amministratore
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [!] ERRORE: Esegui come AMMINISTRATORE per una riparazione completa.
    echo.
)

:: 2. Pulizia Processi
echo [*] Terminazione processi appesi (node, cloudflared, cscript)...
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im cloudflared.exe >nul 2>&1
taskkill /f /im cscript.exe >nul 2>&1
echo [OK] Pulizia completata.

:: 2b. Rimozione Blocchi Database
echo [*] Rimozione file di blocco database (.laccdb)...
del /f /q "%~dp0..\ConsegneDB.laccdb" >nul 2>&1
echo [OK] Blocchi rimossi.

:: 3. Verifica Porta 3002
echo [*] Verifica porta 3002...
netstat -aon | findstr :3002 | findstr LISTENING >nul
if %errorLevel% equ 0 (
    echo [!] ATTENZIONE: La porta 3002 e' ancora occupata. Tentativo di sblocco forzato...
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3002 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
)
echo [OK] Porta 3002 pronta.

:: 4. Sblocco File
echo [*] Sblocco file di sistema (Unblock-File)...
powershell -Command "Get-ChildItem -Path '%~dp0' -Recurse | Unblock-File" >nul 2>&1
echo [OK] File sbloccati.

:: 5. Verifica NODE
echo [*] Verifica installazione Node.js...
node -v >nul 2>&1
if %errorLevel% neq 0 (
    echo [X] ERRORE: Node.js NON e' installato o non e' nel PATH!
    echo     Il ponte mobile NON potra' avviarsi senza Node.js.
) else (
    for /f "tokens=*" %%v in ('node -v') do echo [OK] Node.js rilevato: %%v
)

:: 6. Test Connessione Database (VBS)
echo [*] Test di comunicazione con il database (Tempo max 30 sec)...
set "VBS_TEST=%~dp0server\fetch_consegne.vbs"
if exist "%VBS_TEST%" (
    :: Eseguiamo il test visualizzando l'output direttamente se ci sono errori
    cscript //NoLogo //T:30 "%VBS_TEST%" > test_db_result.txt 2>&1
    if %errorLevel% neq 0 (
        echo [X] ERRORE: Il test ha riportato un problema o e' andato in timeout.
        type test_db_result.txt
    ) else (
        findstr /C:"{" test_db_result.txt >nul
        if %errorLevel% equ 0 (
            echo [OK] Connessione al database riuscita.
        ) else (
            echo [X] ERRORE: Risposta database non valida.
            type test_db_result.txt
        )
    )
    del test_db_result.txt >nul 2>&1
) else (
    echo [X] ERRORE: Script di test non trovato in %VBS_TEST%
)

echo.
echo ============================================================
echo        DIAGNOSTICA COMPLETATA
echo ============================================================
echo Se tutti i test sono [OK], prova ad avviare '2_AVVIA_PONTE_MOBILE'.
echo Se Node.js e' [X], installalo da https://nodejs.org/
echo.
pause
