# =====================================================================
# SCRIPT DI BACKUP AUTOMATICO IN CLOUD - SISTEMA LOGISTICA C. MILELLA
# =====================================================================

$sourceDir = "C:\Users\Utente\Desktop\LOGISTICA_CONSEGNE_MC\questa"
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$zipName = "Backup_Logistica_$timestamp.zip"

# Rilevamento automatico cartelle Cloud
$cloudDirs = @(
    Join-Path $env:USERPROFILE "OneDrive"
    Join-Path $env:USERPROFILE "Google Drive"
    Join-Path $env:USERPROFILE "Dropbox"
    "C:\Cloud_Backup_Logistica" # Fallback
)

$targetDir = $null
foreach ($dir in $cloudDirs) {
    if (Test-Path $dir) {
        $targetDir = Join-Path $dir "Backup_Sistema_Logistica"
        break
    }
}

if (-not $targetDir) {
    $targetDir = "C:\Cloud_Backup_Logistica\Backup_Sistema_Logistica"
}

if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
}

$zipPath = Join-Path $targetDir $zipName

Write-Host "Avvio backup del sistema Logistica C. Milella..." -ForegroundColor Cyan
Write-Host "Destinazione Cloud: $targetDir" -ForegroundColor Yellow

try {
    # Comprime la cartella del progetto
    Compress-Archive -Path $sourceDir -DestinationPath $zipPath -Force
    Write-Host "Backup completato con successo: $zipName" -ForegroundColor Green
    
    # Mantieni solo gli ultimi 7 backup
    $backups = Get-ChildItem -Path $targetDir -Filter "Backup_Logistica_*.zip" | Sort-Object CreationTime -Descending
    if ($backups.Count -gt 7) {
        $backups[7..($backups.Count - 1)] | Remove-Item -Force
        Write-Host "Pulizia vecchi backup completata (mantenuti gli ultimi 7)." -ForegroundColor DarkGray
    }

} catch {
    Write-Host "ERRORE DURANTE IL BACKUP: $_" -ForegroundColor Red
    Read-Host "Premi Invio per uscire..."
    exit 1
}

Start-Sleep -Seconds 3
