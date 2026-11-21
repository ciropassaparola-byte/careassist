# Script per l'importazione automatica delle Buste Paga PDF
# C. Milella - Portale Supervisore Gold

$root = Resolve-Path "$PSScriptRoot\..\.."
$downloadsPath = "$env:USERPROFILE\Downloads"
$archivePath = "$root\File_Sistema\buste paghe\elaborate_automaticamente"
$pdftotext = "$PSScriptRoot\pdftotext.exe"

# Crea la cartella di archivio se non esiste
if (!(Test-Path $archivePath)) {
    New-Item -ItemType Directory -Path $archivePath -Force | Out-Null
}

# 1. Trova l'ultimo database JSON esistente nel portale
$latestJsonFile = Get-ChildItem -Path "$root" -Filter "registro_buste_paga_*.json" | Sort-Object Name -Descending | Select-Object -First 1
if ($latestJsonFile -eq $null) {
    # Fallback se non trovato in root, cerca in gestione_ferie_tfr
    $latestJsonFile = Get-ChildItem -Path "$root\File_Sistema\gestione_ferie_tfr" -Filter "registro_buste_paga_*.json" | Sort-Object Name -Descending | Select-Object -First 1
}

# Leggi il database esistente o inizializza un array vuoto
$database = @()
if ($latestJsonFile -ne $null) {
    try {
        $jsonContent = Get-Content -Path $latestJsonFile.FullName -Raw -Encoding Utf8
        if ($jsonContent.Trim() -ne "") {
            $database = ConvertFrom-Json $jsonContent
        }
    } catch {
        Write-Host "Errore lettura JSON: $_"
    }
}

# 2. Cerca PDF Buste Paga nella cartella Downloads
# Filtra file che contengono parole chiave come busta, paga, cedolino, milella, stipendio
$pdfs = Get-ChildItem -Path $downloadsPath -Filter "*.pdf" -ErrorAction SilentlyContinue | Where-Object {
    $_.Name -match "(?i)(busta|paga|cedolino|milella|stipendio|spettanze)"
}

$updated = $false

foreach ($pdf in $pdfs) {
    Write-Host "Elaborazione file PDF: $($pdf.Name)"
    $tempTxt = "$env:TEMP\$($pdf.BaseName).txt"
    
    # Esegui pdftotext
    $args = @("-layout", "`"$($pdf.FullName)`"", "`"$tempTxt`"")
    Start-Process -FilePath $pdftotext -ArgumentList $args -NoNewWindow -Wait
    
    if (Test-Path $tempTxt) {
        $text = Get-Content -Path $tempTxt -Raw -Encoding Utf8
        Remove-Item $tempTxt -Force
        
        # Estrazione dati tramite Regex
        # Normalizza rimuovendo righe vuote e unendo con doppi spazi
        $lines = $text -split "`r?`n" | ForEach-Object { $_.Trim() } | Where-Object { $_.Length -gt 0 }
        $textNormalized = $lines -join "  "
        
        # Mese e Anno
        $meseStr = $null
        $meseMatch = [regex]::Match($textNormalized, "(?i)(Gennaio|Febbraio|Marzo|Aprile|Maggio|Giugno|Luglio|Agosto|Settembre|Ottobre|Novembre|Dicembre|Tredic\.ma|Quatt\.ma)\s+(202[3-9])")
        if ($meseMatch.Success) {
            $meseStr = "$($meseMatch.Groups[1].Value) $($meseMatch.Groups[2].Value)".ToUpper()
        } else {
            Write-Host "Mese non trovato nel PDF. Salto."
            continue
        }
        
        # Controlla se il mese è già presente nel database
        $exists = $false
        foreach ($rec in $database) {
            if ($rec.mese -eq $meseStr) {
                $exists = $true
                break
            }
        }
        
        if ($exists) {
            Write-Host "Mese $meseStr già presente nel database. Archiviazione file senza importazione."
            # Sposta comunque il PDF in archivio per evitare loop successivi
            Move-Item -Path $pdf.FullName -Destination "$archivePath\$($pdf.Name)" -Force
            continue
        }
        
        # Titolare
        $titolare = "CIRO MILELLA"
        $nomeMatch = [regex]::Match($textNormalized, "([A-Z\s']+)\s+\d{2}/\d{2}/\d{4}")
        if ($nomeMatch.Success) {
            $rawMatch = $nomeMatch.Groups[1].Value.Trim()
            $parts = $rawMatch -split "\s+" | Where-Object { $_ -match "^[A-Z']+$" }
            if ($parts.Count -ge 2) {
                $titolare = "$($parts[-2]) $($parts[-1])"
            } else {
                $titolare = $rawMatch
            }
        }
        
        # Imponibile Irpef
        $imponibileIrpef = "0,00"
        $irpefMatch = [regex]::Match($textNormalized, "(?i)IMPONIBILE\s*(?:IRPEF|FISCALE|FIS|IRP)[\s\S]*?([\d\.]+,\d{2})")
        if ($irpefMatch.Success) {
            $imponibileIrpef = $irpefMatch.Groups[1].Value
        } else {
            $irpefFallback = [regex]::Match($textNormalized, "(?i)(?:Imponibile\s*Irpef|Imponibile\s*fisc)[\s\S]*?([\d\.]+,\d{2})")
            if ($irpefFallback.Success) {
                $imponibileIrpef = $irpefFallback.Groups[1].Value
            }
        }
        
        # Netto in Busta
        $netto = "0,00"
        $nettoMatch = [regex]::Match($textNormalized, "(?i)([\d\.]+,\d{2})(?:(?![\d\.]+,\d{2})[\s\S]){0,150}?FIRMA\s*PER\s*QUIETANZA")
        if ($nettoMatch.Success) {
            $netto = $nettoMatch.Groups[1].Value
        } else {
            $fallback = [regex]::Match($textNormalized, "(?i)PAGARE(?:(?![\d\.]+,\d{2})[\s\S]){0,150}?([\d\.]+,\d{2})")
            if ($fallback.Success) {
                $netto = $fallback.Groups[1].Value
            } else {
                $fallback3 = [regex]::Match($textNormalized, "(?i)BUSTA(?:(?![\d\.]+,\d{2})[\s\S]){0,150}?([\d\.]+,\d{2})")
                if ($fallback3.Success) {
                    $netto = $fallback3.Groups[1].Value
                } else {
                    $fallback4 = [regex]::Match($textNormalized, "(?i)NETTO(?:(?![\d\.]+,\d{2})[\s\S]){0,150}?([\d\.]+,\d{2})")
                    if ($fallback4.Success) {
                        $netto = $fallback4.Groups[1].Value
                    }
                }
            }
        }
        
        # Ferie Residue
        $ferie = "0,00"
        $ferieMatch = [regex]::Match($textNormalized, "(?i)FERIE\s+gg\s+([\d,.\s]+)")
        if ($ferieMatch.Success) {
            $ferie = ($ferieMatch.Groups[1].Value.Trim() -split "\s+")[-1]
        }
        
        # ROL
        $rol = "0,00"
        $rolMatch = [regex]::Match($textNormalized, "(?i)R\.O\.L\.\s+([\d,.\s]+)")
        if ($rolMatch.Success) {
            $rol = ($rolMatch.Groups[1].Value.Trim() -split "\s+")[-1]
        }
        
        # Festività Soppresse
        $festSoppr = "0,00"
        $festMatch = [regex]::Match($textNormalized, "(?i)FEST\.SOPPR\.\s+([\d,.\s]+)")
        if ($festMatch.Success) {
            $festSoppr = ($festMatch.Groups[1].Value.Trim() -split "\s+")[-1]
        }
        
        # TFR Fondo
        $tfrFondo = "0,00"
        $tfrFondoMatch = [regex]::Match($textNormalized, "(?i)Fondo\s+Resid.*?([\d\.]+,\d{2})")
        if ($tfrFondoMatch.Success) {
            $tfrFondo = $tfrFondoMatch.Groups[1].Value
        }
        
        # TFR Anno
        $tfrAnno = "0,00"
        $tfrAnnoMatch = [regex]::Match($textNormalized, "(?i)TFR\s+Imp\.\s+Anno\s+([\d\.]+,\d{2})")
        if ($tfrAnnoMatch.Success) {
            $tfrAnno = $tfrAnnoMatch.Groups[1].Value
        }
        
        # Rimborsi Spesa
        $rimborsi = "0,00"
        $rimbMatch = [regex]::Match($textNormalized, "(?i)142[\s\S]{1,30}?Rimborso[\s\S]*?([\d\.]+,\d{2})(?:\s+([\d\.]+,\d{2}))?(?:\s+([\d\.]+,\d{2}))?")
        if (!$rimbMatch.Success) {
            $rimbMatch = [regex]::Match($textNormalized, "(?i)Rimborso\s*Spese[\s\S]*?([\d\.]+,\d{2})(?:\s+([\d\.]+,\d{2}))?(?:\s+([\d\.]+,\d{2}))?")
        }
        if ($rimbMatch.Success) {
            $nums = @($rimbMatch.Groups[1].Value, $rimbMatch.Groups[2].Value, $rimbMatch.Groups[3].Value) | Where-Object { $_ -ne "" }
            $rimborsi = $nums[-1]
        }
        
        # Calcolo TFR Totale
        $fondoNum = if ($tfrFondo -ne "0,00") { [double]($tfrFondo.Replace(".", "").Replace(",", ".")) } else { 0.0 }
        $annoNum = if ($tfrAnno -ne "0,00") { [double]($tfrAnno.Replace(".", "").Replace(",", ".")) } else { 0.0 }
        $totaleNum = $fondoNum + $annoNum
        $tfrTotale = $totaleNum.ToString("N2", [System.Globalization.CultureInfo]::GetCultureInfo("it-IT"))
        
        # Aggiungi record
        $newRecord = [PSCustomObject]@{
            id               = "rec_$(Get-Date -UFormat %s)_$([Guid]::NewGuid().ToString().Substring(0,8))"
            timestamp        = [long]((Get-Date -Date "1970-01-01").Ticks / 10000) # millisecondi approssimati o timestamp
            mese             = $meseStr
            titolare         = $titolare
            netto            = $netto
            rimborsi         = $rimborsi
            ferieResidue     = $ferie
            rolResidui       = $rol
            festSopprResidue = $festSoppr
            tfrFondo         = $tfrFondo
            tfrAnno          = $tfrAnno
            tfrTotale        = $tfrTotale
            imponibileIrpef  = $imponibileIrpef
        }
        
        $database += $newRecord
        $updated = $true
        
        # Archivia il PDF originale
        Move-Item -Path $pdf.FullName -Destination "$archivePath\$($pdf.Name)" -Force
        Write-Host "Importazione completata con successo per $meseStr."
    }
}

# 3. Salva i file se ci sono stati aggiornamenti
if ($updated) {
    $today = Get-Date -Format "yyyy-MM-dd"
    $newJsonName = "registro_buste_paga_$today.json"
    $newJsonPath = "$root\$newJsonName"
    
    # Salva il nuovo database JSON
    $jsonOutput = ConvertTo-Json $database -Depth 10
    # PowerShell converte in UTF-8 BOM per default, ma vogliamo UTF-8 pulito per compatibilità
    [System.IO.File]::WriteAllText($newJsonPath, $jsonOutput, [System.Text.Encoding]::UTF8)
    
    # Genera il file JS di sincronizzazione per il modulo Buste Paga (Edge/Chrome)
    $jsContent = "window.milellaDataLatest = " + $jsonOutput + ";"
    $jsPath = "$root\File_Sistema\gestione_ferie_tfr\registro_buste_paga_latest.js"
    [System.IO.File]::WriteAllText($jsPath, $jsContent, [System.Text.Encoding]::UTF8)
    
    # Rimuovi i vecchi file JSON in root per non lasciare spazzatura (tranne il nuovo)
    Get-ChildItem -Path "$root" -Filter "registro_buste_paga_*.json" | Where-Object { $_.Name -ne $newJsonName } | Remove-Item -Force
    
    Write-Host "Database aggiornato creato: $newJsonName"
} else {
    Write-Host "Nessuna nuova busta paga importata."
}
