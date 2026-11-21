@echo off
title SOS SISTEMA LOGISTICA - CHIUSURA DI EMERGENZA
echo ============================================================
echo        ATTENZIONE: CHIUSURA DI EMERGENZA IN CORSO
echo ============================================================
echo.
echo Sto chiudendo tutte le maschere (mshta.exe)...
taskkill /F /IM mshta.exe /T
echo.
echo Sto chiudendo eventuali processi AnyDesk residui...
taskkill /F /IM anydesk.exe /T
echo.
echo ------------------------------------------------------------
echo Operazione completata. Tutte le finestre sono state chiuse.
echo Puoi riprovare ad aprire il Dashboard ora.
echo ------------------------------------------------------------
echo.
pause
