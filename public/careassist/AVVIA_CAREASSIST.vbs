Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

strFolder = fso.GetParentFolderName(WScript.ScriptFullName)

' Avvia automaticamente il server Smartphone/Tablet in background (finestra nascosta 0)
strServerJs = strFolder & "\server_smartphone.js"
If fso.FileExists(strServerJs) Then
    WshShell.Run "cmd /c node """ & strServerJs & """", 0, False
End If

strExe = strFolder & "\CareAssist_Pro.exe"
If Not fso.FileExists(strExe) Then
    strExe = strFolder & "\CareAssistPro.exe"
End If

If fso.FileExists(strExe) Then
    WshShell.Run """" & strExe & """", 1, False
Else
    strHtml = strFolder & "\index.html"
    WshShell.Run "explorer """ & strHtml & """", 1, False
End If