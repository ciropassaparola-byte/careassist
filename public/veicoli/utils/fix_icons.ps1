$ErrorActionPreference = "Stop"

$baseDir = "c:\Users\Utente\Desktop\Sistema_Logistica_C_Milella"
$fileSistemaDir = Join-Path $baseDir "File_Sistema"
$assetsImgDir = Join-Path $fileSistemaDir "assets\img"
$premiumIco = Join-Path $assetsImgDir "app_icon_premium.ico"
$vbsLauncher = Join-Path $fileSistemaDir "0_AVVIA_IL_PROGRAMMA.vbs"

Write-Host "--- SISTEMA LOGISTICA C. MILELLA: FIX ICONE ---" -ForegroundColor Cyan

# 1. Verifica Icona
if (-not (Test-Path $premiumIco)) {
    Write-Error "Icona premium non trovata in $premiumIco"
}

# 2. Refresh Scorciatoia Desktop
$shell = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop "SISTEMA LOGISTICA.lnk"

Write-Host "Desktop rilevato in: $desktop"
Write-Host "Rigenerazione scorciatoia sul Desktop: $shortcutPath"
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "wscript.exe"
$shortcut.Arguments = "`"$vbsLauncher`""
$shortcut.WorkingDirectory = $fileSistemaDir
$shortcut.IconLocation = $premiumIco
$shortcut.Description = "Sistema Gestionale Logistica C. Milella"
$shortcut.Save()

# 3. Imposta Icona Cartella LoginWeb e Cartella Root
$loginWebDir = Join-Path $fileSistemaDir "LoginWeb"
$foldersToIconize = @($loginWebDir, $baseDir)

foreach ($dir in $foldersToIconize) {
    if (Test-Path $dir) {
        Write-Host "Impostazione icona per la cartella: $dir"
        
        # Rendi la cartella "System" per abilitare desktop.ini
        attrib +s $dir
        
        $iniPath = Join-Path $dir "desktop.ini"
        $iniContent = @"
[.ShellClassInfo]
IconResource=$premiumIco,0
"@
        Set-Content -Path $iniPath -Value $iniContent -Encoding UTF8 -Force
        attrib +h +s $iniPath
    }
}

# 4. Copia icona in Root per visibilità
Write-Host "Copia icona valida nella Root..."
Copy-Item -Path $premiumIco -Destination (Join-Path $baseDir "app_icon.ico") -Force

# 5. Refresh Icon Cache (Base)
Write-Host "Aggiornamento cache icone Windows..."
$code = @'
[DllImport("shell32.dll", CharSet = CharSet.Auto)]
public static extern void SHChangeNotify(int wEventId, int uFlags, IntPtr dwItem1, IntPtr dwItem2);
'@
Add-Type -MemberDefinition $code -Namespace NativeMethods -Name Shell32
[NativeMethods.Shell32]::SHChangeNotify(0x08000000, 0x0000, [IntPtr]::Zero, [IntPtr]::Zero)

Write-Host "OPERAZIONE COMPLETATA!" -ForegroundColor Green
Write-Host "Ora dovresti vedere la nuova icona arancione sul Desktop."
