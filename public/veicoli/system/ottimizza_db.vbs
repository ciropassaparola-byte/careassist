' =========================================================================
' SCRIPT OTTIMIZZAZIONE E COMPATTAZIONE DATABASE MS ACCESS (JRO)
' =========================================================================
Option Explicit

Dim fso, sh, dbPath, tempDbPath, jro
Dim scriptPath, folderPath

Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")

scriptPath = WScript.ScriptFullName
folderPath = fso.GetParentFolderName(fso.GetParentFolderName(scriptPath))

dbPath = fso.BuildPath(folderPath, "ConsegneDB.accdb")
tempDbPath = fso.BuildPath(folderPath, "ConsegneDB_Temp.accdb")

' Controllo esistenza file
If Not fso.FileExists(dbPath) Then
    MsgBox "File database non trovato: " & dbPath, vbCritical, "Errore Ottimizzazione"
    WScript.Quit 1
End If

On Error Resume Next

' Tentiamo la compattazione con JRO
Set jro = CreateObject("JRO.JetEngine")

If Err.Number <> 0 Then
    MsgBox "Libreria JRO non disponibile. Impossibile ottimizzare il database.", vbExclamation, "Ottimizzazione fallita"
    WScript.Quit 2
End If

' Eseguiamo Compact Database
Dim connSrc, connDest
connSrc = "Provider=Microsoft.ACE.OLEDB.12.0;Data Source=" & dbPath
connDest = "Provider=Microsoft.ACE.OLEDB.12.0;Data Source=" & tempDbPath & ";Jet OLEDB:Engine Type=5;"

' Se esiste un file temporaneo residuo, eliminalo
If fso.FileExists(tempDbPath) Then
    fso.DeleteFile tempDbPath, True
End If

jro.CompactDatabase connSrc, connDest

If Err.Number <> 0 Then
    MsgBox "Errore durante la compattazione del database. Assicurati che il database sia chiuso e riprova." & vbCrLf & "Errore: " & Err.Description, vbCritical, "Ottimizzazione"
    WScript.Quit 3
End If

' Sostituzione file originale col compattato
fso.CopyFile tempDbPath, dbPath, True
fso.DeleteFile tempDbPath, True

MsgBox "Ottimizzazione del Database completata con successo!" & vbCrLf & "Spazio recuperato e indici ricostruiti.", vbInformation, "Ottimizzazione Completata"
