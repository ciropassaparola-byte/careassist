' ====================================================================
' EXPORT PDF RUNNER - ZENITH LOGISTICA (C. MILELLA 2026)
' Generatore nativo PDF via Excel COM per Presenze Mensili
' ====================================================================
On Error Resume Next

Dim args, templatePath, pdfPath, dataPath, mNameVal, yearVal, userVal
Dim fso, shell, tempExcel, excelApp, wb, ws, sh, targetSheet, i
Dim dataFile, lineStr, parts, dNum, rIdx, rowRange, gridRange

Set args = WScript.Arguments
If args.Count < 6 Then WScript.Quit

templatePath = args(0)
pdfPath      = args(1)
dataPath     = args(2)
mNameVal     = UCase(Trim(args(3)))
yearVal      = Trim(args(4))
userVal      = Trim(args(5))

Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

' Crea un file temporaneo Excel in %TEMP% per l'esportazione PDF
tempExcel = fso.BuildPath(shell.ExpandEnvironmentStrings("%TEMP%"), "Logistica_PDF_Stage_" & fso.GetTempName() & ".xlsx")

fso.CopyFile templatePath, tempExcel, True
If Err.Number <> 0 Then WScript.Quit

Set excelApp = CreateObject("Excel.Application")
If excelApp Is Nothing Then WScript.Quit

excelApp.Visible = False
excelApp.DisplayAlerts = False
excelApp.ScreenUpdating = False
excelApp.Calculation = -4135 ' xlCalculationManual
excelApp.EnableEvents = False

Set wb = excelApp.Workbooks.Open(tempExcel)
If wb Is Nothing Then
    excelApp.Quit
    WScript.Quit
End If

Set targetSheet = Nothing
For Each sh In wb.Sheets
    If UCase(Trim(sh.Name)) = mNameVal Then
        Set targetSheet = sh
        Exit For
    End If
Next

If targetSheet Is Nothing Then
    Set targetSheet = wb.Sheets(1)
    targetSheet.Name = mNameVal
End If

targetSheet.Visible = -1
targetSheet.Activate
Set ws = targetSheet

For i = wb.Sheets.Count To 1 Step -1
    If wb.Sheets(i).Name <> ws.Name Then
        wb.Sheets(i).Visible = -1
        wb.Sheets(i).Delete
    End If
Next

ws.Cells.ClearComments
ws.Cells.Validation.Delete

Dim sIdx
For sIdx = ws.Shapes.Count To 1 Step -1
    If ws.Shapes(sIdx).Name = "Year Spinner" Or ws.Shapes(sIdx).Type <> 13 Then
        ws.Shapes(sIdx).Delete
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

Set gridRange = ws.Range("A7:J37")
gridRange.Borders.LineStyle = 1
gridRange.Font.Name = "Times New Roman"
gridRange.Font.Size = 10
gridRange.RowHeight = 14.25
ws.Range("A7:B37").HorizontalAlignment = -4131
ws.Range("C7:J37").HorizontalAlignment = -4108
ws.Range("A7:B37").Interior.Color = 15652797

If fso.FileExists(dataPath) Then
    Set dataFile = fso.OpenTextFile(dataPath, 1)
    Do Until dataFile.AtEndOfStream
        lineStr = dataFile.ReadLine()
        If Trim(lineStr) <> "" Then
            parts = Split(lineStr, "|")
            If UBound(parts) >= 11 Then
                dNum = CInt(parts(0))
                rIdx = 6 + dNum
                
                ws.Cells(rIdx, 1).Value = parts(1)
                ws.Cells(rIdx, 2).Value = parts(2)
                ws.Cells(rIdx, 3).Value = parts(3)
                ws.Cells(rIdx, 4).Value = parts(4)
                ws.Cells(rIdx, 5).Value = parts(5)
                ws.Cells(rIdx, 6).Value = parts(6)
                
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
                If parts(11) = "1" Then
                    rowRange.Interior.Color = 15652797
                    rowRange.Font.Bold = True
                Else
                    ws.Range("C" & rIdx & ":J" & rIdx).Interior.ColorIndex = 0
                    rowRange.Font.Bold = False
                End If
            End If
        End If
    Loop
    dataFile.Close
End If

ws.Columns("A").ColumnWidth = 6.29
ws.Columns("B").ColumnWidth = 11.43

' Impostazione pagina per stampa PDF in un'unica pagina A4
ws.PageSetup.Orientation = 1 ' xlPortrait (o 2 xlLandscape)
ws.PageSetup.Zoom = False
ws.PageSetup.FitToPagesWide = 1
ws.PageSetup.FitToPagesTall = 1

' Esportazione diretta in PDF (0 = xlTypePDF)
If fso.FileExists(pdfPath) Then
    On Error Resume Next
    fso.DeleteFile pdfPath, True
    On Error GoTo 0
End If

ws.ExportAsFixedFormat 0, pdfPath

wb.Close False
excelApp.Quit

' Cancella i file temporanei
fso.DeleteFile tempExcel, True
fso.DeleteFile dataPath, True

' Apri automaticamente il file PDF generato
If fso.FileExists(pdfPath) Then
    shell.Run """" & pdfPath & """"
End If
