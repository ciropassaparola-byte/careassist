' ------------------------------------------------------------------
' AVVIATORE MASTER - SISTEMA LOGISTICA C. MILELLA
' Questo file configura il sistema e avvia il Pannello di Controllo.
' ------------------------------------------------------------------

On Error Resume Next
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

currDir = fso.GetParentFolderName(WScript.ScriptFullName)
htaPath = fso.BuildPath(currDir, "login.hta")
dbPath = fso.BuildPath(currDir, "ConsegneDB.accdb")

' --- CONTROLLO INTEGRITA' ---
If Not fso.FileExists(htaPath) Then
    MsgBox "Errore: File 'login.hta' non trovato nella cartella!" & vbCrLf & "Assicurati di non aver spostato questo file dalla cartella originale.", 16, "Errore Avvio"
    WScript.Quit
End If

' --- AUTOMAZIONE SCORCIATOIA DESKTOP (PORTABILITA') ---
desktopPath = shell.SpecialFolders("Desktop")
If desktopPath = "" Then desktopPath = shell.ExpandEnvironmentStrings("%USERPROFILE%\Desktop")

shortcutPath = fso.BuildPath(desktopPath, "SISTEMA LOGISTICA.lnk")
Set shortcut = shell.CreateShortcut(shortcutPath)
shortcut.TargetPath = "wscript.exe" 
shortcut.Arguments = """" & WScript.ScriptFullName & """"
shortcut.WorkingDirectory = currDir

' Impostazione Icona (Premium Orange)
iconPath = fso.BuildPath(currDir, "assets\img\app_icon_premium.ico")
If fso.FileExists(iconPath) Then
    shortcut.IconLocation = iconPath
Else
    shortcut.IconLocation = "shell32.dll, 10" ' Fallback se l'icona manca
End If

shortcut.Description = "Sistema Gestionale Logistica C. Milella"
shortcut.Save()

' --- LANCIO DEL PROGRAMMA ---
shell.Run "mshta.exe """ & htaPath & """", 1, False
WScript.Quit
