$ErrorActionPreference = "SilentlyContinue"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
# Risaliamo di un livello per arrivare alla root dove c'è il database
$rootDir = (Get-Item $scriptDir).Parent.FullName
$dbPath = Join-Path $rootDir "ConsegneDB_Legacy.sqlite"
$backupDir = Join-Path $rootDir "backups"

# 1. Creazione cartella backup se mancante
if (!(Test-Path $backupDir)) { 
    New-Item -ItemType Directory -Path $backupDir | Out-Null
}

# 2. Definizione del file di destinazione datato
$now = Get-Date -Format "yyyyMMdd_HHmm"
$destFile = "ConsegneDB_AUTO_$now.sqlite"
$destPath = Join-Path $backupDir $destFile

# 3. Esecuzione della copia
if (Test-Path $dbPath) {
    Copy-Item -Path $dbPath -Destination $destPath -Force -ErrorAction SilentlyContinue
}

# 4. Rotazione e Pulizia: Mantieni solo gli ultimi 20 backup automatici
$allBackups = Get-ChildItem $backupDir -Filter "ConsegneDB_AUTO_*.sqlite" | Sort-Object LastWriteTime -Descending
if ($allBackups.Count -gt 20) {
    $toDelete = $allBackups | Select-Object -Skip 20
    foreach ($f in $toDelete) {
        Remove-Item $f.FullName -Force -ErrorAction SilentlyContinue
    }
}
