# import_clienti_excel.ps1
# Sincronizzatore Excel Clienti Puglia Nicola - Logistica C. Milella

$ErrorActionPreference = "Stop"

# Percorsi
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$excelPath = Join-Path (Split-Path $scriptDir -Parent) "_Archivio_Legacy_e_Excel\CLIENTI PUGLIA NICOLA.xlsx"
$statusPath = Join-Path $scriptDir "sync_status.json"

# Inizializza stato
$status = @{
    status = "running"
    progress = 0
    imported = 0
    updated = 0
    skipped_deceduti = 0
    total_rows = 0
    error = $null
}

function Write-Status {
    $status | ConvertTo-Json | Out-File $statusPath -Encoding utf8
}

Write-Status

try {
    # 1. Verifica ed avvia il Bridge Node se necessario
    $portOpen = $false
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $tcp.Connect("127.0.0.1", 3002)
        $portOpen = $true
        $tcp.Close()
    } catch {
        $portOpen = $false
    }

    if (-not $portOpen) {
        $serverJs = Join-Path $scriptDir "App_Mobile\server\server.js"
        if (Test-Path $serverJs) {
            Start-Process node -ArgumentList "`"$serverJs`"" -WindowStyle Hidden
            Start-Sleep -Seconds 3
        } else {
            throw "Bridge server script non trovato in $serverJs"
        }
    }

    # Helper per eseguire query tramite il Bridge
    function Invoke-Query {
        param([string]$sql)
        $uri = "http://127.0.0.1:3002/query"
        $body = @{ sql = $sql } | ConvertTo-Json -Compress
        $res = Invoke-RestMethod -Uri $uri -Method Post -Body $body -ContentType "application/json; charset=utf-8"
        return $res
    }

    # 2. Verifica esistenza file Excel
    if (-not (Test-Path $excelPath)) {
        throw "File Excel non trovato al percorso: $excelPath"
    }

    # 3. Apertura Excel via COM
    Write-Host "Apertura file Excel..."
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    $workbook = $excel.Workbooks.Open($excelPath)

    # 4. Scansione fogli provinciali per estrarre le colonne operative
    Write-Host "Scansione dati operativi per provincia..."
    $operationalData = @{}

    for ($i = 1; $i -le $workbook.Sheets.Count; $i++) {
        $sheet = $workbook.Sheets.Item($i)
        $sheetName = $sheet.Name.ToUpper().Trim()
        if ($sheetName -eq "ALFABETICO") { continue }
        
        Write-Host "Lettura foglio: $sheetName"
        
        # Cerca indici delle colonne
        $colAvvisato = -1
        $colPreventivo = -1
        $colDenom = -1
        
        for ($c = 1; $c -le 20; $c++) {
            $val = $sheet.Cells.Item(1, $c).Value2
            if ($val) {
                $header = $val.ToString().ToLower().Trim()
                if ($header -like "*avvisato*") { $colAvvisato = $c }
                elseif ($header -like "*preventiv*" -or $header -like "*ordin*") { $colPreventivo = $c }
                elseif ($header -like "*denominazion*" -or $header -like "*cognome*") { $colDenom = $c }
            }
        }
        
        if ($colDenom -eq -1) {
            Write-Host "  Colonna denominazione non trovata per il foglio $sheetName. Salto."
            continue
        }
        
        $lastRow = $sheet.UsedRange.Rows.Count
        for ($r = 2; $r -le $lastRow; $r++) {
            $denom = $sheet.Cells.Item($r, $colDenom).Value2
            if ($denom) {
                $name = $denom.ToString().ToUpper().Trim()
                if ($name -eq "") { continue }
                
                $avvisato = ""
                if ($colAvvisato -gt 0) {
                    $v = $sheet.Cells.Item($r, $colAvvisato).Value2
                    if ($v) { $avvisato = $v.ToString().Trim() }
                }
                
                $preventivo = ""
                if ($colPreventivo -gt 0) {
                    $v = $sheet.Cells.Item($r, $colPreventivo).Value2
                    if ($v) { $preventivo = $v.ToString().Trim() }
                }
                
                if ($avvisato -ne "" -or $preventivo -ne "") {
                    # Accoda o sovrascrive
                    $operationalData[$name] = @{
                        Avvisato = $avvisato
                        Preventivo = $preventivo
                    }
                }
            }
        }
    }

    # 5. Lettura foglio ALFABETICO ed importazione anagrafica
    Write-Host "Lettura anagrafica principale..."
    $sheetAlf = $workbook.Sheets.Item("ALFABETICO")
    
    # Cerca indici colonne
    $cols = @{}
    for ($c = 1; $c -le 30; $c++) {
        $val = $sheetAlf.Cells.Item(1, $c).Value2
        if ($val) {
            $header = $val.ToString().ToLower().Trim()
            # Rimuovi accenti ed uniforma
            $header = $header -replace "[àáâ]", "a"
            $header = $header -replace "[èéê]", "e"
            $header = $header -replace "[ìíî]", "i"
            $header = $header -replace "[òóô]", "o"
            $header = $header -replace "[ùúû]", "u"
            $cols[$header] = $c
        }
    }

    $colDen = $cols["denominazione"]
    $colInv = $cols["invalidita"]
    $colCit = $cols["citta"]
    $colPro = $cols["prov"]
    $colEma = $cols["email"]
    $colTel = $cols["tel"]
    $colCel = $cols["cell"]

    if (-not $colDen) {
        throw "Colonna 'Denominazione' non trovata nel foglio ALFABETICO!"
    }

    # Ottieni clienti esistenti
    Write-Host "Verifica anagrafiche esistenti nel database..."
    $existing = Invoke-Query "SELECT ID, CognomeNome FROM tblClienti"
    $existingMap = @{}
    if ($existing) {
        foreach ($cli in $existing) {
            if ($cli.cognomenome) {
                $existingMap[$cli.cognomenome.ToString().ToUpper().Trim()] = $cli.id
            }
        }
    }

    $lastRowAlf = $sheetAlf.UsedRange.Rows.Count
    $status.total_rows = $lastRowAlf - 1
    Write-Status

    # Standardizza Sigle Province
    function Get-SiglaStandard {
        param([string]$prov)
        if ([string]::IsNullOrEmpty($prov)) { return "" }
        $p = $prov.ToUpper().Trim().Replace(".", "")
        if ($p -eq "BARI" -or $p -eq "BA") { return "BA" }
        if ($p -eq "BAT" -or $p -eq "BT") { return "BT" }
        if ($p -eq "FOGGIA" -or $p -eq "FG") { return "FG" }
        if ($p -eq "TARANTO" -or $p -eq "TA") { return "TA" }
        if ($p -eq "BRINDISI" -or $p -eq "BR") { return "BR" }
        if ($p -eq "LECCE" -or $p -eq "LE") { return "LE" }
        if ($p -eq "MATERA" -or $p -eq "MT") { return "MT" }
        if ($p -eq "CAMPOBASSO" -or $p -eq "CB") { return "CB" }
        return $p
    }

    Write-Host "Inizio sincronizzazione record..."
    for ($r = 2; $r -le $lastRowAlf; $r++) {
        $status.progress = [math]::Round((($r - 2) / ($lastRowAlf - 1)) * 100)
        
        $denomVal = $sheetAlf.Cells.Item($r, $colDen).Value2
        if (-not $denomVal) { continue }
        $cognomeNome = $denomVal.ToString().ToUpper().Trim()
        if ($cognomeNome -eq "") { continue }

        # Controllo deceduti
        $invaliditaRaw = ""
        if ($colInv) {
            $v = $sheetAlf.Cells.Item($r, $colInv).Value2
            if ($v) { $invaliditaRaw = $v.ToString().Trim() }
        }
        if ($invaliditaRaw.ToUpper().Contains("DECEDUT")) {
            $status.skipped_deceduti++
            if (($r % 50) -eq 0 -or $r -eq $lastRowAlf) { Write-Status }
            continue
        }

        # Dati geografici
        $citta = ""
        if ($colCit) {
            $v = $sheetAlf.Cells.Item($r, $colCit).Value2
            if ($v) { $citta = $v.ToString().Trim() }
        }
        $provRaw = ""
        if ($colPro) {
            $v = $sheetAlf.Cells.Item($r, $colPro).Value2
            if ($v) { $provRaw = $v.ToString().Trim() }
        }
        $provincia = Get-SiglaStandard $provRaw

        # Telefoni
        $phones = @()
        if ($colTel) {
            $v = $sheetAlf.Cells.Item($r, $colTel).Value2
            if ($v) { $phones += $v.ToString().Trim() }
        }
        if ($colCel) {
            $v = $sheetAlf.Cells.Item($r, $colCel).Value2
            if ($v) { $phones += $v.ToString().Trim() }
        }
        $telefono = $phones -join ";"

        # Email
        $email = ""
        if ($colEma) {
            $v = $sheetAlf.Cells.Item($r, $colEma).Value2
            if ($v) { $email = $v.ToString().Trim() }
        }

        # Normalizzazione Tipo Invalidità
        $invalidita = "Altro"
        $upInv = $invaliditaRaw.ToUpper()
        if ($upInv -eq "CIECO") { $invalidita = "Cieco" }
        elseif ($upInv -eq "IPOVEDENTE") { $invalidita = "Ipovedente" }
        elseif ($invaliditaRaw -ne "") { $invalidita = $invaliditaRaw.Substring(0,1).ToUpper() + $invaliditaRaw.Substring(1).ToLower() }

        # Dati Operativi dai fogli provinciali
        $avvisato = ""
        $preventivo = ""
        if ($operationalData.ContainsKey($cognomeNome)) {
            $avvisato = $operationalData[$cognomeNome].Avvisato
            $preventivo = $operationalData[$cognomeNome].Preventivo
        }

        # Query di salvataggio
        if ($existingMap.ContainsKey($cognomeNome)) {
            # Esiste già: Aggiorna campi operativi (ed eventualmente i contatti)
            $id = $existingMap[$cognomeNome]
            $sql = "UPDATE tblClienti SET 
                AvvisatoIl = '{0}', 
                PreventivoOrdine = '{1}',
                DataUltimaModifica = datetime('now', 'localtime') 
                WHERE ID = {2}" -f $avvisato.Replace("'", "''"), $preventivo.Replace("'", "''"), $id
            $null = Invoke-Query $sql
            $status.updated++
        } else {
            # Nuovo inserimento
            $sql = "INSERT INTO tblClienti (CognomeNome, Localita, Provincia, Telefono, StatoGravita, Email, AvvisatoIl, PreventivoOrdine, Note, Residenza, Cap, CodFisc, PIva, SDI, PEC, PercorsoFoto, isCancellato, DataInserimento, DataUltimaModifica) VALUES (
                '{0}', '{1}', '{2}', '{3}', '{4}', '{5}', '{6}', '{7}', '', '', '', '', '', '', '', '', 0, datetime('now', 'localtime'), datetime('now', 'localtime'))" -f $cognomeNome.Replace("'", "''"), $citta.Replace("'", "''"), $provincia.Replace("'", "''"), $telefono.Replace("'", "''"), $invalidita.Replace("'", "''"), $email.Replace("'", "''"), $avvisato.Replace("'", "''"), $preventivo.Replace("'", "''")
            $null = Invoke-Query $sql
            $status.imported++
        }

        if (($r % 25) -eq 0 -or $r -eq $lastRowAlf) { Write-Status }
    }

    # Chiudi excel
    $workbook.Close($false)
    $excel.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
    
    $status.status = "completed"
    $status.progress = 100
    Write-Status
    Write-Host "Sincronizzazione completata!"
} catch {
    $err = $_.ToString()
    Write-Host "ERRORE: $err" -ForegroundColor Red
    
    if ($excel) {
        try { $workbook.Close($false); $excel.Quit() } catch {}
    }
    
    $status.status = "error"
    $status.error = $err
    Write-Status
}
