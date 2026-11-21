' SCRIPT PER RECUPERO STORICO (CONSEGNE COMPLETATE) - (V2 - Robust Connection)
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
        ' Accesso condiviso (Read-Only/Shared)
        cnObj.Open "Provider=" & p & ";Data Source=" & dbPath & ";Mode=Read;Jet OLEDB:Database Locking Mode=1;"
        If Err.Number = 0 Then
            Set GetConnection = cnObj
            Exit Function
        End If
    Next
    Set GetConnection = Nothing
End Function

Set cn = GetConnection()
If cn Is Nothing Then
    WScript.Echo "[]"
    WScript.Quit
End If

currYear = Year(Date)

' Filtra per tutto l'anno corrente per permettere la consultazione dei mesi passati
sql = "SELECT * FROM tblConsegne WHERE Year(DataConsegna) = " & currYear & " ORDER BY DataConsegna DESC, OraConsegna DESC"
Set rs = cn.Execute(sql)

WScript.Echo "["
first = True

Do While Not rs.EOF
    If Not first Then WScript.Echo ","
    WScript.Echo "{"
    WScript.Echo """id"": " & rs("ID") & ","
    WScript.Echo """cliente"": """ & S(rs("ClienteNome")) & ""","
    WScript.Echo """citta"": """ & S(rs("LocalitaConsegna")) & ""","
    WScript.Echo """indirizzo"": """ & S(rs("IndirizzoConsegna")) & ""","
    WScript.Echo """data"": """ & S(rs("DataConsegna")) & ""","
    WScript.Echo """ora"": """ & S(rs("OraConsegna")) & ""","
    WScript.Echo """stato"": """ & S(rs("Stato")) & ""","
    WScript.Echo """telefono"": """ & S(rs("Telefono")) & ""","
    WScript.Echo """kma"": """ & S(rs("KmAndata")) & ""","
    WScript.Echo """kmr"": """ & S(rs("KmRitorno")) & ""","
    WScript.Echo """merce"": """ & S(rs("Merce")) & """"
    WScript.Echo "}"
    first = False
    rs.MoveNext
Loop

WScript.Echo "]"

rs.Close
cn.Close

Function S(val)
    If IsNull(val) Then
        S = ""
    Else
        temp = Replace(val, """", "\""")
        temp = Replace(temp, vbCrLf, " ")
        S = temp
    End If
End Function
