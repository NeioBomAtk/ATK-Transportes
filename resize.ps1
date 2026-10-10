Add-Type -AssemblyName System.Drawing

$srcPath = 'c:\Apps\atk\www\assets\atk transportes e logistica.png'
$srcBmp = [System.Drawing.Image]::FromFile($srcPath)

$cropSize = [int]($srcBmp.Width * 0.82)
$cropX = [int](($srcBmp.Width - $cropSize) / 2)
$cropY = [int](($srcBmp.Height - $cropSize) / 2)
$cropRect = New-Object System.Drawing.Rectangle($cropX, $cropY, $cropSize, $cropSize)

$destSizesAdaptive = @{
    'mdpi' = 108
    'hdpi' = 162
    'xhdpi' = 216
    'xxhdpi' = 324
    'xxxhdpi' = 432
}

$destSizesLegacy = @{
    'mdpi' = 48
    'hdpi' = 72
    'xhdpi' = 96
    'xxhdpi' = 144
    'xxxhdpi' = 192
}

foreach ($kv in $destSizesAdaptive.GetEnumerator()) {
    $key = $kv.Key
    $folder = "c:\Apps\atk\res\mipmap-$key"
    if (-not (Test-Path $folder)) { continue }
    
    $size = $kv.Value
    $destBmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($destBmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    
    $destRect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    $g.DrawImage($srcBmp, $destRect, $cropRect, [System.Drawing.GraphicsUnit]::Pixel)
    
    $targetFg = Join-Path $folder 'ic_launcher_foreground.png'
    $targetMono = Join-Path $folder 'ic_launcher_monochrome.png'
    $targetBg = Join-Path $folder 'ic_launcher_background.png'
    
    Remove-Item -Path $targetFg -ErrorAction SilentlyContinue
    Remove-Item -Path $targetMono -ErrorAction SilentlyContinue
    
    $destBmp.Save($targetFg, [System.Drawing.Imaging.ImageFormat]::Png)
    $destBmp.Save($targetMono, [System.Drawing.Imaging.ImageFormat]::Png)
    
    $g.Dispose()
    $destBmp.Dispose()
}

foreach ($kv in $destSizesLegacy.GetEnumerator()) {
    $key = $kv.Key
    $folder = "c:\Apps\atk\res\mipmap-$key"
    if (-not (Test-Path $folder)) { continue }
    
    $size = $kv.Value
    $destBmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($destBmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    
    $destRect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    $g.DrawImage($srcBmp, $destRect, $cropRect, [System.Drawing.GraphicsUnit]::Pixel)
    
    $targetLegacy = Join-Path $folder 'ic_launcher.png'
    Remove-Item -Path $targetLegacy -ErrorAction SilentlyContinue
    $destBmp.Save($targetLegacy, [System.Drawing.Imaging.ImageFormat]::Png)
    
    $g.Dispose()
    $destBmp.Dispose()
}

$srcBmp.Dispose()
Write-Output 'Done'
