@echo off
echo ============================================================
echo PULIZIA PROCESSI WORD CONGELATI
echo ============================================================
echo Questo script terminera' tutte le istanze di Microsoft Word
echo attive per sbloccare eventuali conflitti con la stampante.
echo.
taskkill /F /IM winword.exe /T
echo.
echo ============================================================
echo OPERAZIONE COMPLETATA
echo Adesso puoi riprovare a generare il documento.
echo ============================================================
pause
