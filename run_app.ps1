$projectRoot = $PSScriptRoot
$syncHealthUrl = 'http://127.0.0.1:25556/health'
try {
    Invoke-RestMethod -Uri $syncHealthUrl -TimeoutSec 1 | Out-Null
} catch {
    Start-Process -FilePath 'node' -ArgumentList "`"$projectRoot\sync-server.js`"" -WorkingDirectory $projectRoot -WindowStyle Hidden
    Start-Sleep -Milliseconds 500
}

# Perfil isolado e exclusivo para o app ATK (desmembrando do Chrome pessoal do usuario)
$profileDir = "C:\Apps\atk\ChromeProfile"
if (-not (Test-Path $profileDir)) {
    New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
}

# Carregar assemblies do Windows Forms para detecção dinâmica de monitores
Add-Type -AssemblyName System.Windows.Forms

# Identificar dinamicamente a tela de 7 polegadas (modo retrato / vertical ou menor secundaria)
$screens = [System.Windows.Forms.Screen]::AllScreens
$targetScreen = $screens | Where-Object { -not $_.Primary -and ($_.Bounds.Height -gt $_.Bounds.Width) } | Select-Object -First 1

if (-not $targetScreen) {
    # Fallback caso a orientacao tenha mudado: menor tela que nao seja a principal
    $targetScreen = $screens | Where-Object { -not $_.Primary } | Sort-Object { $_.Bounds.Width * $_.Bounds.Height } | Select-Object -First 1
}

if (-not $targetScreen) {
    $targetScreen = [System.Windows.Forms.Screen]::PrimaryScreen
}

# Usar Bounds completos da tela de 7 polegadas
$posX = $targetScreen.Bounds.X
$posY = $targetScreen.Bounds.Y
$posW = $targetScreen.Bounds.Width
$posH = $targetScreen.Bounds.Height

# Argumentos do Chrome: perfil dedicado (--user-data-dir), sem barra (--kiosk) e na posicao correta
$chromeArgs = "--user-data-dir=`"$profileDir`" --app=`"file:///C:/Apps/atk/www/index.html`" --kiosk --window-position=$posX,$posY --window-size=$posW,$posH --no-first-run --no-default-browser-check"
Start-Process "C:\Program Files\Google\Chrome\Application\chrome.exe" -ArgumentList $chromeArgs
