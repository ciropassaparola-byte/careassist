@echo off
chcp 65001 > nul
title Crea Icona sul Desktop - Progetto Salute

set "TARGET_DIR=%~dp0"
set "EXE_PATH=%TARGET_DIR%dist\ProgettoSalute-win32-x64\ProgettoSalute.exe"
if not exist "%EXE_PATH%" (
    set "EXE_PATH=%TARGET_DIR%ProgettoSalute.exe"
) else (
    set "TARGET_DIR=%TARGET_DIR%dist\ProgettoSalute-win32-x64\"
)
set "VBS_SCRIPT=%TEMP%\create_desktop_shortcut_%RANDOM%.vbs"

(
echo Set WshShell = CreateObject("WScript.Shell"^)
echo strDesktop = WshShell.SpecialFolders("Desktop"^)
echo Set oLink = WshShell.CreateShortcut(strDesktop ^& "\Progetto Salute.lnk"^)
echo oLink.TargetPath = "%EXE_PATH%"
echo oLink.WorkingDirectory = "%TARGET_DIR%"
echo oLink.IconLocation = "%EXE_PATH%,0"
echo oLink.Description = "Progetto Salute e Alimentazione"
echo oLink.Save
) > "%VBS_SCRIPT%"

cscript //nologo "%VBS_SCRIPT%" > nul 2>&1
del "%VBS_SCRIPT%" > nul 2>&1
