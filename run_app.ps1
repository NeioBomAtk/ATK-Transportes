$projectRoot = $PSScriptRoot
$syncHealthUrl = 'http://127.0.0.1:25556/health'
try {
    Invoke-RestMethod -Uri $syncHealthUrl -TimeoutSec 1 | Out-Null
} catch {
    Start-Process -FilePath 'node' -ArgumentList "`"$projectRoot\sync-server.js`"" -WorkingDirectory $projectRoot -WindowStyle Hidden
    Start-Sleep -Milliseconds 500
}

# Se já houver uma janela antiga do ATK aberta, fecha para aplicar o modo sem barra
Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { 
    $_.MainWindowHandle -ne [IntPtr]::Zero -and ($_.MainWindowTitle -match "ATK" -or $_.MainWindowTitle -match "Transportes")
} | Stop-Process -Force -ErrorAction SilentlyContinue

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

# Usar Bounds completos da tela de 7 polegadas para ocupar 100% da tela sem barras
$posX = $targetScreen.Bounds.X
$posY = $targetScreen.Bounds.Y
$posW = $targetScreen.Bounds.Width
$posH = $targetScreen.Bounds.Height

# Iniciar o Chrome em modo App + Kiosk (elimina a barra cinza de titulo do navegador)
$chromeArgs = "--app=`"file:///C:/Apps/atk/www/index.html`" --kiosk --window-position=$posX,$posY --window-size=$posW,$posH"
Start-Process "C:\Program Files\Google\Chrome\Application\chrome.exe" -ArgumentList $chromeArgs

# Definir funcoes Win32 para garantir o posicionamento exato na tela de 7 polegadas
$code = @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
    [DllImport("user32.dll")]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@
Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue

# Aguardar ate a janela do app estar pronta
$hwnd = [IntPtr]::Zero
for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Milliseconds 300
    $procs = Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { 
        $_.MainWindowHandle -ne [IntPtr]::Zero -and ($_.MainWindowTitle -match "ATK" -or $_.MainWindowTitle -match "Transportes")
    }
    if ($procs -and $procs.Count -gt 0) {
        $hwnd = $procs[0].MainWindowHandle
        break
    }
}

if ($hwnd -ne [IntPtr]::Zero) {
    # 0x0040 = SWP_SHOWWINDOW
    [Win32]::SetWindowPos($hwnd, [IntPtr]::Zero, $posX, $posY, $posW, $posH, 0x0040)
    [Win32]::SetForegroundWindow($hwnd)
}
