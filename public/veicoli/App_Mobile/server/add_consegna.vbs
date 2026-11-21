' SCRIPT PER INSERIMENTO NUOVA CONSEGNA - (V2 - Robust Connection)
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
    WScript.Echo "{""success"": false, ""error"": ""Errore connessione DB""}"
    WScript.Quit 1
End If

' Recupero Argomenti (Nome, Città, Indirizzo, Tel, Merce, Data)
nome = WScript.Arguments(0)
citta = WScript.Arguments(1)
ind = WScript.Arguments(2)
tel = WScript.Arguments(3)
merce = WScript.Arguments(4)

If WScript.Arguments.Count > 5 Then
    data_consegna = WScript.Arguments(5)
Else
    data_consegna = Date()
End If

sql = "INSERT INTO tblConsegne (ClienteNome, LocalitaConsegna, IndirizzoConsegna, Telefono, Merce, DataConsegna, Stato) " & _
      "VALUES ('" & Replace(nome,"'","''") & "', '" & Replace(citta,"'","''") & "', '" & Replace(ind,"'","''") & "', '" & Replace(tel,"'","''") & "', '" & Replace(merce,"'","''") & "', '" & data_consegna & "', 'DA LOGISTICA')"

cn.Execute sql

If Err.Number <> 0 Then
    WScript.Echo "{""success"": false, ""error"": """ & Replace(Err.Description, """", "'") & """}"
Else
    WScript.Echo "{""success"": true}"
End If

cn.Close
