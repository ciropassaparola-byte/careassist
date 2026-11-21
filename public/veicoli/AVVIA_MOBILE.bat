@echo off
title START_MOBILE_BRIDGE_PLATINUM
echo [BENVENUTO] Avvio del ponte dati per il cellulare...
cd /d "%~dp0App_Mobile"
start "" "MOBILE_BRIDGE_MASTER.hta"
exit
