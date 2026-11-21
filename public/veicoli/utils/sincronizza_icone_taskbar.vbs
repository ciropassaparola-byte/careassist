Option Explicit

Dim fso, folder, file, content, regex, Matches, Match, iconIndex, f
Set fso = CreateObject("Scripting.FileSystemObject")

' Verifica parametri
If WScript.Arguments.Count < 1 Then
    WScript.Quit
End If

Dim iconPath
If WScript.Arguments.Count = 1 Then
    ' Compatibilità con vecchio formato (solo index di shell32)
    iconPath = "shell32.dll"
    iconIndex = WScript.Arguments(0)
Else
    iconPath = WScript.Arguments(0)
    iconIndex = WScript.Arguments(1)
End If

' Percorsi
Dim scriptPath, projectDir
scriptPath = WScript.ScriptFullName
projectDir = fso.GetParentFolderName(fso.GetParentFolderName(scriptPath))
WScript.Echo "Project Dir: " & projectDir

' Regex per trovare la riga ICON (sia maiuscola che minuscola)
Set regex = New RegExp
regex.Global = True
regex.IgnoreCase = True
regex.Multiline = True
regex.Pattern = "ICON\s*=\s*""[^""]*"""

' Scansione file HTA
Set folder = fso.GetFolder(projectDir)
Dim logFile
Set logFile = fso.CreateTextFile(fso.BuildPath(projectDir, "sync_log.txt"), True)
logFile.WriteLine "Project Dir: " & projectDir
logFile.WriteLine "Icon Path: " & iconPath

For Each file In folder.Files
    If LCase(fso.GetExtensionName(file.Name)) = "hta" Then
        logFile.WriteLine "Checking file: " & file.Name
        ' Leggi file
        content = fso.OpenTextFile(file.Path, 1).ReadAll
        
        ' Sostituisci
        If regex.Test(content) Then
            logFile.WriteLine "Found ICON in " & file.Name
            content = regex.Replace(content, "ICON=""" & iconPath & ", " & iconIndex & """")
            
            ' Scrivi file
            Set f = fso.OpenTextFile(file.Path, 2)
            f.Write content
            f.Close
            logFile.WriteLine "Updated " & file.Name
        Else
            logFile.WriteLine "ICON NOT FOUND in " & file.Name
        End If
    End If
Next
logFile.Close
