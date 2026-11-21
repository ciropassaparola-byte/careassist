$pngPath = "c:\Users\Utente\Desktop\Sistema_Logistica_C_Milella\File_Sistema\assets\img\app_icon_premium.png"
$icoPath = "c:\Users\Utente\Desktop\Sistema_Logistica_C_Milella\File_Sistema\assets\img\app_icon_premium.ico"

if (Test-Path $pngPath) {
    Add-Type -AssemblyName System.Drawing
    $srcImg = [System.Drawing.Image]::FromFile($pngPath)
    
    # Ridimensionamento a 256x256 (standard ICO massimo)
    $newImg = New-Object System.Drawing.Bitmap(256, 256)
    $g = [System.Drawing.Graphics]::FromImage($newImg)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($srcImg, 0, 0, 256, 256)
    
    # Salvataggio in streaming PNG per ottenere i byte compressi
    $ms = New-Object System.IO.MemoryStream
    $newImg.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $pngBytes = $ms.ToArray()
    $pngSize = $pngBytes.Length

    # ICO Header (6 bytes) + 1 Icon Directory Entry (16 bytes)
    $icoHeader = New-Object byte[] 22
    $icoHeader[0] = 0; $icoHeader[1] = 0; $icoHeader[2] = 1; $icoHeader[3] = 0; $icoHeader[4] = 1; $icoHeader[5] = 0
    $icoHeader[6] = 0 # Width (0 = 256)
    $icoHeader[7] = 0 # Height (0 = 256)
    $icoHeader[8] = 0 # Colors
    $icoHeader[9] = 0 # Reserved
    $icoHeader[10] = 1 # Color Planes
    $icoHeader[11] = 0
    $icoHeader[12] = 32 # Bits per pixel
    $icoHeader[13] = 0
    
    # Size: 4 bytes (little endian)
    $icoHeader[14] = $pngSize -band 0xFF
    $icoHeader[15] = ($pngSize -shr 8) -band 0xFF
    $icoHeader[16] = ($pngSize -shr 16) -band 0xFF
    $icoHeader[17] = ($pngSize -shr 24) -band 0xFF
    
    # Offset: 4 bytes (little endian) - 22 bytes after header
    $icoHeader[18] = 22
    $icoHeader[19] = 0
    $icoHeader[20] = 0
    $icoHeader[21] = 0
    
    # Combine
    $fullIco = New-Object byte[] ($icoHeader.Length + $pngBytes.Length)
    [System.Buffer]::BlockCopy($icoHeader, 0, $fullIco, 0, $icoHeader.Length)
    [System.Buffer]::BlockCopy($pngBytes, 0, $fullIco, $icoHeader.Length, $pngBytes.Length)
    
    [System.IO.File]::WriteAllBytes($icoPath, $fullIco)
    
    $g.Dispose()
    $newImg.Dispose()
    $srcImg.Dispose()
    $ms.Dispose()
    
    Write-Host "Icona rigenerata con successo (256x256): $icoPath"
} else {
    Write-Error "Immagine PNG sorgente non trovata."
}
