' SCRIPT PER AGGIORNAMENTO STATO CONSEGNA (V2 - Robust Connection)
On Error Resume Next

Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
dbPath = fso.BuildPath(currentDir, "..\..\ConsegneDB.accdb")

Function GetConnection()
    Dim cnObj, providers, p
    providers = Array("Microsoft.ACE.OLEDB.16.0", "Microsoft.ACE.OLEDB.12.0", "Microsoft.Jet.OLEDB.4.0")
    For Each p In providers
        Err.Clear
        Set cnObj = CreateObject("ADODB.Connection")
        cnObj.Open "Provider=" & p & ";Data Source=" & dbPath & ";"
        If Err.Number = 0 Then
            Set GetConnection = cnObj
            Exit Function
        End If
    Next
    Set GetConnection = Nothing
End Function

Set cn = GetConnection()
If cn Is Nothing Then
    WScript.Echo "{""success"": false, ""error"": ""Errore Connessione DB""}"
    WScript.Quit
End If

id = WScript.Arguments(0)
NuovoStato = WScript.Arguments(1)

' Impostiamo anche il flag Consegnato a True (spunta CHIUSA? nel gestionale)
sql = "UPDATE tblConsegne SET [Stato] = '" & NuovoStato & "', [Consegnato] = True WHERE [ID] = " & id
cn.Execute sql

If Err.Number <> 0 Then
    WScript.Echo "{""success"": false, ""error"": ""Errore update: " & Replace(Err.Description, """", "'") & """}"
Else
    WScript.Echo "{""success"": true}"
End If

cn.Close
