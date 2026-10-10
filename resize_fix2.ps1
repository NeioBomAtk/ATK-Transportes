Add-Type -AssemblyName System.Drawing

$srcPath = 'c:\Apps\atk\www\assets\atk transportes e logistica.png'
$srcBmp = [System.Drawing.Image]::FromFile($srcPath)

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

# For adaptive, image should be ~56% of the size so it fits perfectly in safe zone
foreach ($kv in $destSizesAdaptive.GetEnumerator()) {
    $key = $kv.Key
    $folder = "c:\Apps\atk\res\mipmap-$key"
    if (-not (Test-Path $folder)) { continue }
    
    $size = $kv.Value
    $destBmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($destBmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.Clear([System.Drawing.Color]::Black) # fill background with black
    
    $innerSize = [int]($size * 0.56)
    $offset = [int](($size - $innerSize) / 2)
    
    $destRect = New-Object System.Drawing.Rectangle($offset, $offset, $innerSize, $innerSize)
    $g.DrawImage($srcBmp, $destRect, 0, 0, $srcBmp.Width, $srcBmp.Height, [System.Drawing.GraphicsUnit]::Pixel)
    
    $targetFg = Join-Path $folder 'ic_launcher_foreground.png'
    $targetMono = Join-Path $folder 'ic_launcher_monochrome.png'
    
    Remove-Item -Path $targetFg -ErrorAction SilentlyContinue
    Remove-Item -Path $targetMono -ErrorAction SilentlyContinue
    
    $destBmp.Save($targetFg, [System.Drawing.Imaging.ImageFormat]::Png)
    $destBmp.Save($targetMono, [System.Drawing.Imaging.ImageFormat]::Png)
    
    $g.Dispose()
    $destBmp.Dispose()
}

# For legacy, we can make it fill 85% of the box
foreach ($kv in $destSizesLegacy.GetEnumerator()) {
    $key = $kv.Key
    $folder = "c:\Apps\atk\res\mipmap-$key"
    if (-not (Test-Path $folder)) { continue }
    
    $size = $kv.Value
    $destBmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($destBmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.Clear([System.Drawing.Color]::Transparent) 
    
    $innerSize = [int]($size * 0.85)
    $offset = [int](($size - $innerSize) / 2)
    
    $destRect = New-Object System.Drawing.Rectangle($offset, $offset, $innerSize, $innerSize)
    $g.DrawImage($srcBmp, $destRect, 0, 0, $srcBmp.Width, $srcBmp.Height, [System.Drawing.GraphicsUnit]::Pixel)
    
    $targetLegacy = Join-Path $folder 'ic_launcher.png'
    Remove-Item -Path $targetLegacy -ErrorAction SilentlyContinue
    $destBmp.Save($targetLegacy, [System.Drawing.Imaging.ImageFormat]::Png)
    
    $g.Dispose()
    $destBmp.Dispose()
}

$srcBmp.Dispose()
Write-Output 'Done'
