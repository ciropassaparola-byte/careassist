Set shell = CreateObject("WScript.Shell")
startupPath = shell.SpecialFolders("Startup")
shortcutPath = startupPath & "\MonitorDriver.lnk"
Set shortcut = shell.CreateShortcut(shortcutPath)
shortcut.TargetPath = "wscript.exe"
shortcut.Arguments = """E:\SISTEMA_LOGISTICA_PRO\questa\Sistema_Logistica_C_Milella\File_Sistema\MONITOR_DRIVER.vbs"""
shortcut.WindowStyle = 7 ' Minimizzato
shortcut.Save
WScript.Echo "OK"
