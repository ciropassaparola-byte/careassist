Add-Type -AssemblyName System.Drawing
$PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
$projectRoot = Split-Path -Parent $PSScriptRoot
$pngPath = Join-Path $projectRoot "assets\img\app_icon_cm.png"
$icoPath = Join-Path $projectRoot "assets\img\app_icon_cm.ico"

if (Test-Path $pngPath) {
    Write-Host "Conversione in corso: $pngPath -> $icoPath" -ForegroundColor Cyan
    $img = [System.Drawing.Image]::FromFile($pngPath)
    $bitmap = New-Object System.Drawing.Bitmap($img)
    $iconHandle = $bitmap.GetHicon()
    $icon = [System.Drawing.Icon]::FromHandle($iconHandle)
    $stream = [System.IO.File]::Create($icoPath)
    $icon.Save($stream)
    $stream.Close()
    $icon.Dispose()
    $bitmap.Dispose()
    $img.Dispose()
    Write-Host "OPERAZIONE COMPLETATA! Adesso riavvia il programma per vedere l'icona." -ForegroundColor Green
} else {
    Write-Host "Errore: Immagine sorgente non trovata in $pngPath" -ForegroundColor Red
}
Pause
