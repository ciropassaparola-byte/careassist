On Error Resume Next

Dim args, nome, luogo, dataN, ind, tipo, dataDal, dataAl, gg1, gg2, gg3, h1Txt, h2Txt, nGTxt, currentDir
Dim fso, shell, projectRoot, archiveDir, ts, sanitizedNome, fileName, fullPath
Dim wordApp, doc, sel, oggTxt, count104, labelGG, dExp, oggiS, t, l, savedStatus, dPath

Set args = WScript.Arguments
If args.Count < 14 Then WScript.Quit

nome = args(0)
luogo = args(1)
dataN = args(2)
ind = args(3)
tipo = args(4)
dataDal = args(5)
dataAl = args(6)
gg1 = args(7)
gg2 = args(8)
gg3 = args(9)
h1Txt = args(10)
h2Txt = args(11)
nGTxt = args(12)
currentDir = args(13)

Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

projectRoot = fso.GetParentFolderName(currentDir)
archiveDir = fso.BuildPath(projectRoot, "Archivio_Permessi")

If Not fso.FolderExists(archiveDir) Then fso.CreateFolder(archiveDir)

ts = Year(Now) & Right("0" & Month(Now), 2) & Right("0" & Day(Now), 2) & "_" & Right("0" & Hour(Now), 2) & Right("0" & Minute(Now), 2)
sanitizedNome = Replace(Replace(Replace(Replace(Replace(nome, "\", ""), "/", ""), "*", ""), "?", ""), " ", "_")
fileName = "Richiesta_" & sanitizedNome & "_" & ts & ".pdf"
fullPath = archiveDir & "\" & fileName

Set wordApp = CreateObject("Word.Application")
wordApp.Visible = False
wordApp.DisplayAlerts = 0
wordApp.Options.PrintBackground = False
wordApp.Options.UpdateLinksAtOpen = False

Set doc = wordApp.Documents.Add()

doc.PageSetup.TopMargin = 72
doc.PageSetup.BottomMargin = 72
doc.PageSetup.LeftMargin = 85
doc.PageSetup.RightMargin = 85

Set sel = wordApp.Selection
sel.Font.Name = "Times New Roman"
sel.Font.Size = 12

sel.ParagraphFormat.Alignment = 0
sel.TypeText "Alla c. a. Presidente" & vbCrLf
sel.TypeText "Della Societ" & Chr(224) & " Cooperativa Sociale Aurelio Nicolodi" & vbCrLf
sel.TypeText "Sig. Giuseppe Simone" & vbCrLf & vbCrLf & vbCrLf

sel.Font.Bold = True
If tipo = "Legge 104/92" Then
    oggTxt = "Legge 104/92"
ElseIf tipo = "Ferie" Then
    oggTxt = "Ferie"
Else
    oggTxt = "RoL"
End If
sel.TypeText "Oggetto: richiesta permessi (" & oggTxt & ")" & vbCrLf & vbCrLf & vbCrLf

sel.Font.Bold = False
sel.ParagraphFormat.Alignment = 3
sel.TypeText "Il sottoscritto "
sel.Font.Bold = True
sel.TypeText nome
sel.Font.Bold = False
sel.TypeText " nato a "
sel.Font.Bold = True
sel.TypeText luogo
sel.Font.Bold = False
sel.TypeText " il "
sel.Font.Bold = True
sel.TypeText dataN
sel.Font.Bold = False
sel.TypeText " residente in "
sel.Font.Bold = True
sel.TypeText ind
sel.Font.Bold = False
sel.TypeText " in qualit" & Chr(224) & " di dipendente di codesto Ente "

If tipo = "Ferie" Then
    sel.TypeText "chiede di poter usufruire del periodo di ferie dal "
    sel.Font.Bold = True
    sel.TypeText dataDal
    sel.Font.Bold = False
    sel.TypeText " al "
    sel.Font.Bold = True
    sel.TypeText dataAl
    sel.Font.Bold = False
    sel.TypeText " per un totale di n. "
    sel.Font.Bold = True
    sel.TypeText nGTxt
    sel.Font.Bold = False
    sel.TypeText " giorni."
ElseIf tipo = "Legge 104/92" Then
    count104 = 0
    If gg1 <> "" Then count104 = count104 + 1
    If gg2 <> "" Then count104 = count104 + 1
    If gg3 <> "" Then count104 = count104 + 1
    
    If count104 = 1 Then labelGG = "nel giorno" Else labelGG = "nei giorni"
    
    sel.TypeText "chiede di poter usufruire del permesso Legge 104/92 " & labelGG & " "
    If gg1 <> "" Then
        sel.Font.Bold = True
        sel.TypeText gg1
        sel.Font.Bold = False
    End If
    If gg2 <> "" Then
        If gg1 <> "" Then sel.TypeText " e "
        sel.Font.Bold = True
        sel.TypeText gg2
        sel.Font.Bold = False
    End If
    If gg3 <> "" Then
        If gg1 <> "" Or gg2 <> "" Then sel.TypeText " e "
        sel.Font.Bold = True
        sel.TypeText gg3
        sel.Font.Bold = False
    End If
    sel.TypeText "."
Else
    sel.TypeText "chiede di poter usufruire di un permesso (" & tipo & ") nel giorno "
    sel.Font.Bold = True
    sel.TypeText dataDal
    sel.Font.Bold = False
    sel.TypeText " dalle ore "
    sel.Font.Bold = True
    sel.TypeText h1Txt
    sel.Font.Bold = False
    sel.TypeText " alle ore "
    sel.Font.Bold = True
    sel.TypeText h2Txt
    sel.Font.Bold = False
    sel.TypeText "."
End If

sel.TypeText vbCrLf & vbCrLf & "Certo di un riscontro positivo porgo cordiali saluti." & vbCrLf & vbCrLf & vbCrLf
sel.ParagraphFormat.Alignment = 0

oggiS = Right("0" & Day(Now), 2) & "/" & Right("0" & Month(Now), 2) & "/" & Year(Now)
sel.TypeText "Bari, " & oggiS & vbCrLf & vbCrLf & vbCrLf

sel.Font.Bold = False

sel.ParagraphFormat.TabStops.ClearAll
sel.ParagraphFormat.TabStops.Add 250, 0, 0

t = vbTab
sel.TypeText "Firma dipendente" & t & "Per accettazione" & vbCrLf & vbCrLf

l = "___________________________"
sel.TypeText l & t & l & vbCrLf
sel.TypeText nome & t & "Il Presidente" & vbCrLf

savedStatus = False
doc.ExportAsFixedFormat fullPath, 17
If Err.Number = 0 Then
    savedStatus = True
Else
    Err.Clear
    dPath = Replace(fullPath, ".pdf", ".doc")
    doc.SaveAs dPath, 0
    If Err.Number = 0 Then
        fullPath = dPath
        savedStatus = True
    End If
End If

If Not doc Is Nothing Then doc.Close 0
If Not wordApp Is Nothing Then wordApp.Quit 0

If savedStatus Then
    ' --- OUTLOOK INTEGRATION ---
    Dim outlookApp, mailItem
    On Error Resume Next
    Set outlookApp = CreateObject("Outlook.Application")
    If Not outlookApp Is Nothing Then
        Set mailItem = outlookApp.CreateItem(0)
        mailItem.To = "presidente@coopnicolodi.it"
        mailItem.Subject = "Nuova Richiesta " & oggTxt & " - " & nome
        mailItem.Body = "Gentile Presidente," & vbCrLf & vbCrLf & "In allegato la richiesta di " & oggTxt & " del dipendente " & nome & "." & vbCrLf & vbCrLf & "Cordiali saluti," & vbCrLf & "Sistema Logistica C. Milella"
        mailItem.Attachments.Add fullPath
        mailItem.Display
    End If
    Err.Clear
    ' ---------------------------
    
    WScript.Echo "OK:" & fullPath
Else
    WScript.Echo "ERR:Impossibile salvare il file"
End If
