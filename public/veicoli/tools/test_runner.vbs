' ====================================================================
' EXPORT EXCEL RUNNER - ZENITH LOGISTICA (C. MILELLA 2026)
' Generatore nativo Excel COM per Esportazione Presenze Mensili
' ====================================================================
' On Error Resume Next

Dim args, templatePath, finalPath, dataPath, mNameVal, yearVal, userVal
Dim fso, excelApp, wb, ws, sh, targetSheet, i
Dim dataFile, lineStr, parts, dNum, rIdx, rowRange, colAB, colCH

Set args = WScript.Arguments
If args.Count < 6 Then
    WScript.Quit
End If

templatePath = args(0)
finalPath    = args(1)
dataPath     = args(2)
mNameVal     = UCase(Trim(args(3)))
yearVal      = Trim(args(4))
userVal      = Trim(args(5))

Set fso = CreateObject("Scripting.FileSystemObject")

' Copia il file modello nella destinazione finale con gestione file bloccato/in uso
' On Error Resume Next
Err.Clear
fso.CopyFile templatePath, finalPath, True
If Err.Number <> 0 Then
    MsgBox "⚠️ IMPOSSIBILE SALVARE IL FOGLIO EXCEL PRESENZE!" & vbCrLf & vbCrLf & _
           "Il file Excel del mese (" & fso.GetFileName(finalPath) & ") è attualmente APERTO in Microsoft Excel o bloccato da un altro processo in background." & vbCrLf & vbCrLf & _
           "👉 SOLUZIONE: Chiudi il file Excel aperto sul computer e riprova a esportare o salvare.", 48, "Zenith Logistica - File Excel Bloccato"
    WScript.Quit
End If
On Error GoTo 0

' Avvia Excel COM
Set excelApp = CreateObject("Excel.Application")
If excelApp Is Nothing Then
    WScript.Quit
End If

excelApp.Visible = False
excelApp.DisplayAlerts = False

Set wb = excelApp.Workbooks.Open(finalPath)
If wb Is Nothing Then
    excelApp.Quit
    WScript.Quit
End If

' Individua il foglio corrispondente al mese selezionato (es. SETTEMBRE)
Set targetSheet = Nothing
For Each sh In wb.Sheets
    If UCase(Trim(sh.Name)) = mNameVal Then
        Set targetSheet = sh
        Exit For
    End If
Next

' Se non esiste un foglio con quel nome, usa il primo foglio e rinominalo
If targetSheet Is Nothing Then
    Set targetSheet = wb.Sheets(1)
    ' On Error Resume Next
    targetSheet.Name = mNameVal
    On Error GoTo 0
End If

' Rendi il foglio selezionato visibile e attivo
targetSheet.Visible = -1 ' xlSheetVisible
targetSheet.Activate
Set ws = targetSheet

' Rimuovi tutti gli altri fogli per mantenere un unico foglio pulito
For i = wb.Sheets.Count To 1 Step -1
    If wb.Sheets(i).Name <> ws.Name Then
        ' On Error Resume Next
        wb.Sheets(i).Visible = -1
        wb.Sheets(i).Delete
        On Error GoTo 0
    End If
Next

' Pulizia commenti, note e messaggi di convalida dati nelle celle
' On Error Resume Next
ws.Cells.ClearComments
ws.Cells.Validation.Delete
On Error GoTo 0

' Rimuovi controlli Form/Spinner legacy (conserva solo il logo immagine Type=13)
Dim sIdx
For sIdx = ws.Shapes.Count To 1 Step -1
    If ws.Shapes(sIdx).Name = "Year Spinner" Or ws.Shapes(sIdx).Type <> 13 Then
        ' On Error Resume Next
        ws.Shapes(sIdx).Delete
        On Error GoTo 0
    End If
Next

' Font globale Times New Roman
ws.Cells.Font.Name = "Times New Roman"

' Sostituzione Intestazioni Utente
ws.Cells.Replace "MILELLA CIRO", userVal, 2, 1, False
ws.Cells.Replace "CIRO MILELLA", userVal, 2, 1, False
ws.Cells.Replace "ADMIN", userVal, 2, 1, False

' Aggiornamento Intestazione Mese in F2 e sostituzione di "MARZO"
ws.Cells.Replace "MARZO", mNameVal, 2, 1, False
ws.Range("F2").Value = "MESE DI " & mNameVal & " " & yearVal
ws.Range("F2").Font.Bold = True
ws.Range("F2").Font.Name = "Times New Roman"
ws.Range("D3").Value = "MANSIONE: IMPIEGATO"

' Leggi il file dati temporaneo e popola le righe del mese
If fso.FileExists(dataPath) Then
    Set dataFile = fso.OpenTextFile(dataPath, 1)
    Do Until dataFile.AtEndOfStream
        lineStr = dataFile.ReadLine()
        If Trim(lineStr) <> "" Then
            parts = Split(lineStr, "|")
            ' Formato: dNum|sDataIT|dayName|e1|u1|e2|u2|userSig|permessi|status|note|isWeekendHoliday
            If UBound(parts) >= 11 Then
                dNum = CInt(parts(0))
                rIdx = 6 + dNum
                
                ws.Cells(rIdx, 1).Value = parts(1) ' es. 01-set
                ws.Cells(rIdx, 2).Value = parts(2) ' es. GIOVEDI
                ws.Cells(rIdx, 3).Value = parts(3) ' Entrata 1
                ws.Cells(rIdx, 4).Value = parts(4) ' Uscita 1
                ws.Cells(rIdx, 5).Value = parts(5) ' Entrata 2
                ws.Cells(rIdx, 6).Value = parts(6) ' Uscita 2
                
                ' Firma inserita SOLO se ci sono orari lavorativi E NON è un giorno di assenza (FERIE/MALATTIA/L.104)
                If Trim(parts(9)) <> "" Then
                    ws.Cells(rIdx, 7).Value = ""
                ElseIf Trim(parts(3)) <> "" Or Trim(parts(4)) <> "" Or Trim(parts(5)) <> "" Or Trim(parts(6)) <> "" Then
                    ws.Cells(rIdx, 7).Value = parts(7)
                Else
                    ws.Cells(rIdx, 7).Value = ""
                End If
                
                If CDbl(parts(8)) > 0 Then 
                    ws.Cells(rIdx, 8).Value = CDbl(parts(8))
                Else
                    ws.Cells(rIdx, 8).Value = ""
                End If
                
                ws.Cells(rIdx, 9).Value = parts(9)
                ws.Cells(rIdx, 10).Value = parts(10)
                
                ' Applicazione bordi e stili
                Set rowRange = ws.Range("A" & rIdx & ":J" & rIdx)
                rowRange.Borders.LineStyle = 1
                rowRange.Font.Name = "Times New Roman"
                rowRange.Font.Size = 10
                rowRange.RowHeight = 14.25
                
                Set colAB = ws.Range("A" & rIdx & ":B" & rIdx)
                Set colCH = ws.Range("C" & rIdx & ":J" & rIdx)
                colAB.HorizontalAlignment = -4131 ' Sinistra
                colCH.HorizontalAlignment = -4108 ' Centro
                colAB.Interior.Color = 15652797 ' Azzurrino
                
                If parts(11) = "1" Then
                    rowRange.Interior.Color = 15652797
                    rowRange.Font.Bold = True
                Else
                    colCH.Interior.ColorIndex = 0
                    rowRange.Font.Bold = False
                End If
                
            End If
        End If
    Loop
    dataFile.Close
End If

' Calibrazione larghezze
ws.Columns("A").ColumnWidth = 6.29
ws.Columns("B").ColumnWidth = 11.43

' Salva le modifiche nel file finale e rendi Excel visibile
wb.Save
excelApp.Visible = True

' Cancella il file temporaneo dei dati
' On Error Resume Next
fso.DeleteFile dataPath

