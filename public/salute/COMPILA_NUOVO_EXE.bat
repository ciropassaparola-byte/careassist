@echo off
chcp 65001 > nul
title Compilatore Progetto Salute - Generatore .EXE
color 0A

echo ======================================================================
echo           PROGETTO SALUTE - COMPILATORE AUTOMATICO .EXE               
echo ======================================================================
echo.
echo [1/3] Preparazione file sorgente, immagini e ricette...
echo [2/3] Compilazione ed impacchettamento protetto (ASAR)...
echo.
echo Attendere qualche secondo, il processo sta creando ProgettoSalute.exe...
echo.

cd /d "%~dp0"
call npm run build:exe

if %ERRORLEVEL% equ 0 (
    echo.
    echo ======================================================================
    echo  COMPILAZIONE COMPLETATA CON SUCCESSO!
    echo ======================================================================
    echo.
    echo L'eseguibile aggiornato e' stato salvato nella cartella:
    echo "%~dp0dist\ProgettoSalute-win32-x64\ProgettoSalute.exe"
    copy /y "%~dp0Crea_Icona_Sul_Desktop.bat" "%~dp0dist\ProgettoSalute-win32-x64\" > nul
    copy /y "%~dp0AVVIA_PROGETTO_SALUTE.bat" "%~dp0dist\ProgettoSalute-win32-x64\" > nul
    if not exist "%~dp0dist\ProgettoSalute-win32-x64\Backup_Salute" mkdir "%~dp0dist\ProgettoSalute-win32-x64\Backup_Salute" > nul 2>&1
    echo.
    echo [3/3] Apertura della cartella con il nuovo .exe...
    start "" "%~dp0dist\ProgettoSalute-win32-x64"
    echo.
) else (
    echo.
    echo ======================================================================
    echo  ATTENZIONE: Si e' verificato un errore durante la compilazione.
    echo ======================================================================
    echo.
)

echo Premi un tasto qualsiasi per chiudere questa finestra...
pause > nul
