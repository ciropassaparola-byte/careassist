' SCRIPT DI SUPPORTO PER BRIDGE MOBILE - Nuclear-Strength JSON Version (V2 - Robust Connection)
' Corretto: rimosse colonne Lat/Lon non presenti nel database
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
        ' Aggiunta parametri di condivisione per evitare errori se il DB e' aperto (laccdb)
        cnObj.Open "Provider=" & p & ";Data Source=" & dbPath & ";Mode=Share Deny None;Jet OLEDB:Database Locking Mode=1;"
        If Err.Number = 0 Then
            Set GetConnection = cnObj
            Exit Function
        End If
    Next
    Set GetConnection = Nothing
End Function

Set cn = GetConnection()
If cn Is Nothing Then
    WScript.Echo "[]" ' Ritorna array vuoto se connessione fallisce
    WScript.Quit
End If

' Funzione di pulizia JSON Totale
Function S(val)
    If IsNull(val) Or val = "" Then 
        S = ""
    Else
        Dim sVal
        sVal = CStr(val)
        ' Rimpiazza i caratteri che rompono il JSON
        sVal = Replace(sVal, "\", "\\")
        sVal = Replace(sVal, """", "\""")
        sVal = Replace(sVal, vbCr, " ")
        sVal = Replace(sVal, vbLf, " ")
        sVal = Replace(sVal, vbTab, " ")
        sVal = Replace(sVal, Chr(13), " ")
        sVal = Replace(sVal, Chr(10), " ")
        S = sVal
    End If
End Function

' Carichiamo solo le consegne NON completate
' NumeroOrdine aggiunto come 'ordine' per compatibilita'
sql = "SELECT [ID], [ClienteNome], [LocalitaConsegna], [IndirizzoConsegna], [Provincia], [DataConsegna], [OraConsegna], [Stato], [Telefono], [KmAndata], [KmRitorno], [Merce], [Note], [NumeroOrdine] FROM tblConsegne WHERE (Consegnato = False OR Consegnato IS NULL) ORDER BY [ID] DESC"
Set rs = cn.Execute(sql)

If Err.Number <> 0 Or rs Is Nothing Then
    WScript.Echo "[]"
    WScript.Quit
End If

WScript.Echo "["
first = True

While Not rs.EOF
    If Not first Then WScript.Echo ","
    WScript.Echo "{"
    WScript.Echo """id"": """ & S(rs("ID")) & ""","
    WScript.Echo """cliente"": """ & S(rs("ClienteNome")) & ""","
    WScript.Echo """citta"": """ & S(rs("LocalitaConsegna")) & ""","
    WScript.Echo """indirizzo"": """ & S(rs("IndirizzoConsegna")) & ""","
    WScript.Echo """provincia"": """ & S(rs("Provincia")) & ""","
    WScript.Echo """data"": """ & S(rs("DataConsegna")) & ""","
    WScript.Echo """ora"": """ & S(rs("OraConsegna")) & ""","
    WScript.Echo """stato"": """ & S(rs("Stato")) & ""","
    WScript.Echo """telefono"": """ & S(rs("Telefono")) & ""","
    WScript.Echo """kma"": """ & S(rs("KmAndata")) & ""","
    WScript.Echo """kmr"": """ & S(rs("KmRitorno")) & ""","
    WScript.Echo """merce"": """ & S(rs("Merce")) & ""","
    WScript.Echo """ordine"": """ & S(rs("NumeroOrdine")) & ""","
    WScript.Echo """note"": """ & S(rs("Note")) & """"
    WScript.Echo "}"
    first = False
    rs.MoveNext
Wend

WScript.Echo "]"

rs.Close
cn.Close
