' ==============================================================================
' MEDNUTRI PRO - AVVIATORE PORTATILE CHIAVETTA USB
' Avvia l'applicazione medica in modalita Desktop dedicata.
' Tutti i dati dei pazienti, profilo e patologie rimangono isolati al 100%
' all'interno della cartella della chiavetta USB (nessun dato resta sul PC ospite).
' ==============================================================================
Option Explicit
On Error Resume Next

Dim fso, shell, scriptDir, dataDir, htmlFile, edgePath, chromePath, browserExe, cmd

Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

' 1. Determina il percorso della chiavetta / cartella corrente
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
htmlFile = fso.BuildPath(scriptDir, "index.html")
dataDir = fso.BuildPath(scriptDir, "Dati_Clinici_USB")

' Se non esiste, crea la cartella dedicata ai dati sulla chiavetta
If Not fso.FolderExists(dataDir) Then
    fso.CreateFolder(dataDir)
End If

' 2. Individua Microsoft Edge o Google Chrome sul computer
browserExe = ""

' Cerca Microsoft Edge (presente sul 99% dei PC Windows 10/11)
edgePath = shell.ExpandEnvironmentStrings("%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe")
If Not fso.FileExists(edgePath) Then
    edgePath = shell.ExpandEnvironmentStrings("%ProgramFiles%\Microsoft\Edge\Application\msedge.exe")
End If
If Not fso.FileExists(edgePath) Then
    edgePath = shell.ExpandEnvironmentStrings("%LocalAppData%\Microsoft\Edge\Application\msedge.exe")
End If

' Cerca Google Chrome come alternativa
chromePath = shell.ExpandEnvironmentStrings("%ProgramFiles%\Google\Chrome\Application\chrome.exe")
If Not fso.FileExists(chromePath) Then
    chromePath = shell.ExpandEnvironmentStrings("%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe")
End If
If Not fso.FileExists(chromePath) Then
    chromePath = shell.ExpandEnvironmentStrings("%LocalAppData%\Google\Chrome\Application\chrome.exe")
End If

If fso.FileExists(edgePath) Then
    browserExe = edgePath
ElseIf fso.FileExists(chromePath) Then
    browserExe = chromePath
End If

' 3. Avvia in modalita "App Desktop" con profilo dati isolato sulla pennetta USB
If browserExe <> "" Then
    ' --app apre il programma senza barre del browser (come una vera applicazione desktop)
    ' --user-data-dir salva l'intero database locale (localStorage e cookie) dentro la cartella USB!
    cmd = """" & browserExe & """ --app=""file:///" & Replace(htmlFile, "\", "/") & """ --user-data-dir=""" & dataDir & """ --allow-file-access-from-files --no-first-run --no-default-browser-check"
    shell.Run cmd, 1, False
Else
    ' Fallback nel caso estremo in cui non trovi ne Edge ne Chrome
    shell.Run """" & htmlFile & """", 1, False
End If

Set fso = Nothing
Set shell = Nothing
