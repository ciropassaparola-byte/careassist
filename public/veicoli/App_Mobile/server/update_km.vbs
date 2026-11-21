' SCRIPT PER AGGIORNARE DETTAGLI CONSEGNA (V3 - Robust Access Connection)
On Error Resume Next

If WScript.Arguments.Count < 9 Then
    WScript.Echo "{""success"": false, ""error"": ""Parametri insufficienti""}"
    WScript.Quit
End If

id = WScript.Arguments(0)
kma = WScript.Arguments(1)
kmr = WScript.Arguments(2)
merce = WScript.Arguments(3)
note = WScript.Arguments(4)
nome = WScript.Arguments(5)
fdata = WScript.Arguments(6)
ora = WScript.Arguments(7)
stato = WScript.Arguments(8)

Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
dbPath = fso.GetAbsolutePathName(fso.BuildPath(currentDir, "..\..\ConsegneDB.accdb"))

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
    WScript.Echo "{""success"": false, ""error"": ""Errore Connessione DB: Nessun provider compatibile trovato. Path: " & dbPath & """}"
    WScript.Quit
End If

Function Esc(val)
    Esc = Replace(val, "'", "''")
End Function

Function ToNum(val)
    If val = "" Or Not IsNumeric(val) Then
        ToNum = "0"
    Else
        ToNum = Replace(val, ",", ".")
    End If
End Function

' Costruzione SQL 
sql = "UPDATE tblConsegne SET " & _
      "[KmAndata] = " & ToNum(kma) & ", " & _
      "[KmRitorno] = " & ToNum(kmr) & ", " & _
      "[Merce] = '" & Esc(merce) & "', " & _
      "[Note] = '" & Esc(note) & "', " & _
      "[ClienteNome] = '" & Esc(nome) & "', " & _
      "[DataConsegna] = '" & Esc(fdata) & "', " & _
      "[OraConsegna] = '" & Esc(ora) & "', " & _
      "[Stato] = '" & Esc(stato) & "' " & _
      "WHERE [ID] = " & id

cn.Execute sql

' Se fallisce il primo tentativo (es. tipo data non corrispondente)
If Err.Number <> 0 Then
    Err.Clear
    ' SECONDO TENTATIVO con formattazione data Access #MM/DD/YYYY#
    dParts = Split(fdata, "/")
    If UBound(dParts) = 2 Then
        accessDate = "#" & dParts(1) & "/" & dParts(0) & "/" & dParts(2) & "#"
    Else
        accessDate = "'" & Esc(fdata) & "'"
    End If
    
    accessOra = "#" & ora & "#"

    sql = "UPDATE tblConsegne SET " & _
          "[KmAndata] = " & ToNum(kma) & ", " & _
          "[KmRitorno] = " & ToNum(kmr) & ", " & _
          "[Merce] = '" & Esc(merce) & "', " & _
          "[Note] = '" & Esc(note) & "', " & _
          "[ClienteNome] = '" & Esc(nome) & "', " & _
          "[DataConsegna] = " & accessDate & ", " & _
          "[OraConsegna] = " & accessOra & ", " & _
          "[Stato] = '" & Esc(stato) & "' " & _
          "WHERE [ID] = " & id
          
    cn.Execute sql
End If

If Err.Number <> 0 Then
    WScript.Echo "{""success"": false, ""error"": ""Errore SQL (" & Err.Number & "): " & Replace(Err.Description, """", "'") & """}"
Else
    WScript.Echo "{""success"": true}"
End If

cn.Close
