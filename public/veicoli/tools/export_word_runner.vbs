' ====================================================================
' EXPORT WORD RUNNER - ZENITH LOGISTICA (C. MILELLA 2026)
' Generatore nativo Word COM per Esportazione Presenze Mensili
' ====================================================================
On Error Resume Next

Dim args, templatePath, finalWordPath, dataPath, mNameVal, yearVal, userVal
Dim fso, excelApp, wb, ws, sh, targetSheet, i, sIdx
Dim dataFile, lineStr, parts, dNum, rIdx, rowRange, colAB, colCH, lastDay, dUnused
Dim wordApp, wordDoc, shell, tbl, copyRange, tempXlsxPath

Set args = WScript.Arguments
If args.Count < 6 Then
    WScript.Quit
End If

templatePath  = args(0)
finalWordPath = args(1)
dataPath      = args(2)
mNameVal      = UCase(Trim(args(3)))
yearVal       = Trim(args(4))
userVal       = Trim(args(5))

Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

' 1. Genera prima la struttura Excel formattata in background
Set excelApp = CreateObject("Excel.Application")
If excelApp Is Nothing Then WScript.Quit

excelApp.Visible = False
excelApp.DisplayAlerts = False

tempXlsxPath = fso.BuildPath(fso.GetParentFolderName(dataPath), "temp_word_" & Month(Now) & "_" & Day(Now) & "_" & Second(Now) & ".xlsx")

fso.CopyFile templatePath, tempXlsxPath, True
Set wb = excelApp.Workbooks.Open(tempXlsxPath)
If wb Is Nothing Then
    excelApp.Quit
    WScript.Quit
End If

' Individua il foglio corrispondente al mese selezionato
Set targetSheet = Nothing
For Each sh In wb.Sheets
    If UCase(Trim(sh.Name)) = mNameVal Then
        Set targetSheet = sh
        Exit For
    End If
Next

If targetSheet Is Nothing Then
    Set targetSheet = wb.Sheets(1)
    On Error Resume Next
    targetSheet.Name = mNameVal
    On Error GoTo 0
End If

targetSheet.Visible = -1 ' xlSheetVisible
targetSheet.Activate
Set ws = targetSheet

' Rimuovi altri fogli
For i = wb.Sheets.Count To 1 Step -1
    If wb.Sheets(i).Name <> ws.Name Then
        On Error Resume Next
        wb.Sheets(i).Visible = -1
        wb.Sheets(i).Delete
        On Error GoTo 0
    End If
Next

' Pulizia commenti, note e messaggi di convalida dati
On Error Resume Next
ws.Cells.ClearComments
ws.Cells.Validation.Delete
On Error GoTo 0

' Rimuovi controlli Form/Spinner legacy
For sIdx = ws.Shapes.Count To 1 Step -1
    If ws.Shapes(sIdx).Name = "Year Spinner" Or ws.Shapes(sIdx).Type <> 13 Then
        On Error Resume Next
        ws.Shapes(sIdx).Delete
        On Error GoTo 0
    End If
Next

ws.Cells.Font.Name = "Times New Roman"
ws.Cells.Replace "MILELLA CIRO", userVal, 2, 1, False
ws.Cells.Replace "CIRO MILELLA", userVal, 2, 1, False
ws.Cells.Replace "ADMIN", userVal, 2, 1, False

ws.Cells.Replace "MARZO", mNameVal, 2, 1, False
ws.Range("F2").Value = "MESE DI " & mNameVal & " " & yearVal
ws.Range("F2").Font.Bold = True
ws.Range("F2").Font.Name = "Times New Roman"
ws.Range("D3").Value = "MANSIONE: IMPIEGATO"

lastDay = 31
If fso.FileExists(dataPath) Then
    Set dataFile = fso.OpenTextFile(dataPath, 1)
    Do Until dataFile.AtEndOfStream
        lineStr = dataFile.ReadLine()
        If Trim(lineStr) <> "" Then
            parts = Split(lineStr, "|")
            If UBound(parts) >= 11 Then
                dNum = CInt(parts(0))
                If dNum > lastDay Then lastDay = dNum
                rIdx = 6 + dNum
                
                ws.Cells(rIdx, 1).Value = parts(1)
                ws.Cells(rIdx, 2).Value = parts(2)
                ws.Cells(rIdx, 3).Value = parts(3)
                ws.Cells(rIdx, 4).Value = parts(4)
                ws.Cells(rIdx, 5).Value = parts(5)
                ws.Cells(rIdx, 6).Value = parts(6)
                
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
                
                Set rowRange = ws.Range("A" & rIdx & ":J" & rIdx)
                rowRange.Borders.LineStyle = 1
                rowRange.Font.Name = "Times New Roman"
                rowRange.Font.Size = 10
                rowRange.RowHeight = 14.25
                
                Set colAB = ws.Range("A" & rIdx & ":B" & rIdx)
                Set colCH = ws.Range("C" & rIdx & ":J" & rIdx)
                colAB.HorizontalAlignment = -4131
                colCH.HorizontalAlignment = -4108
                colAB.Interior.Color = 15652797
                
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

ws.Columns("A").ColumnWidth = 6.29
ws.Columns("B").ColumnWidth = 11.43

' Nascondi righe non usate
For dUnused = lastDay + 1 To 31
    On Error Resume Next
    ws.Rows(6 + dUnused).EntireRow.Hidden = True
    On Error GoTo 0
Next

wb.Save

' 2. Esportazione in Word
Set wordApp = CreateObject("Word.Application")
If Not wordApp Is Nothing Then
    wordApp.Visible = True
    wordApp.DisplayAlerts = 0
    Set wordDoc = wordApp.Documents.Add()
    wordDoc.PageSetup.Orientation = 1 ' Landscape
    wordDoc.PageSetup.TopMargin = 30
    wordDoc.PageSetup.BottomMargin = 30
    wordDoc.PageSetup.LeftMargin = 30
    wordDoc.PageSetup.RightMargin = 30
    
    Set copyRange = ws.Range("A1:J" & (6 + lastDay))
    copyRange.Copy
    
    On Error Resume Next
    wordDoc.Content.Paste
    If Err.Number <> 0 Then
        Err.Clear
        wordDoc.Content.PasteExcelTable False, False, False
    End If
    On Error GoTo 0
    
    If wordDoc.Tables.Count > 0 Then
        Set tbl = wordDoc.Tables(1)
        tbl.Range.Font.Size = 10
        tbl.Range.Font.Name = "Times New Roman"
        tbl.Rows.Alignment = 1 ' Centra
    End If
    
    wordDoc.SaveAs finalWordPath
    
    wb.Close False
    excelApp.Quit
    
    On Error Resume Next
    fso.DeleteFile tempXlsxPath
    fso.DeleteFile dataPath
    On Error GoTo 0
    
    wordApp.Activate
Else
    ' Fallback se Word non è disponibile tramite COM: Salva come WebArchive / HTML compatibile Word
    On Error Resume Next
    wb.SaveAs finalWordPath, 45 ' xlWebArchive
    wb.Close False
    excelApp.Quit
    shell.Run """" & finalWordPath & """"
    On Error Resume Next
    fso.DeleteFile tempXlsxPath
    fso.DeleteFile dataPath
End If
