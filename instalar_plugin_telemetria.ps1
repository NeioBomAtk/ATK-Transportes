<#
.SYNOPSIS
    Instalador Automático e Global do Plugin de Telemetria ATK para ETS2 e ATS.
.DESCRIPTION
    Detecta automaticamente as pastas de instalação do Euro Truck Simulator 2
    e American Truck Simulator em qualquer disco rígido (C:, D:, E:, F:, etc.),
    via Registro do Windows, bibliotecas do Steam (libraryfolders.vdf) e varredura de discos.
    Copia o plugin ets2-telemetry-server.dll para a pasta bin\win_x64\plugins.
#>

$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "       ATK TRANSPORTES - INSTALADOR DE TELEMETRIA        " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Procurando instalacoes do Euro Truck Simulator 2 / ATS em todos os discos..." -ForegroundColor Gray

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
$sourceDllX64 = Join-Path $scriptRoot "Servidor_Telemetria_ATK\Ets2Plugins\win_x64\plugins\ets2-telemetry-server.dll"
$sourceDllX86 = Join-Path $scriptRoot "Servidor_Telemetria_ATK\Ets2Plugins\win_x86\plugins\ets2-telemetry-server.dll"

if (-not (Test-Path $sourceDllX64)) {
    # Fallback se executado dentro da subpasta Servidor_Telemetria_ATK
    $sourceDllX64 = Join-Path $scriptRoot "Ets2Plugins\win_x64\plugins\ets2-telemetry-server.dll"
    $sourceDllX86 = Join-Path $scriptRoot "Ets2Plugins\win_x86\plugins\ets2-telemetry-server.dll"
}

if (-not (Test-Path $sourceDllX64)) {
    Write-Host "[ERRO] Arquivo do plugin nao encontrado: ets2-telemetry-server.dll" -ForegroundColor Red
    Write-Host "Certifique-se de que a pasta Servidor_Telemetria_ATK esta completa." -ForegroundColor Red
    pause
    exit 1
}

$gameDirs = @()

# 1. Busca no Registro do Windows (Steam App IDs: ETS2 = 227300, ATS = 270880)
$steamAppIds = @("227300", "270880")
foreach ($appId in $steamAppIds) {
    $regPaths = @(
        "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\Steam App $appId",
        "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\Steam App $appId"
    )
    foreach ($reg in $regPaths) {
        if (Test-Path $reg) {
            $loc = (Get-ItemProperty $reg -ErrorAction SilentlyContinue).InstallLocation
            if ($loc -and (Test-Path $loc)) {
                $gameDirs += $loc
            }
        }
    }
}

# 2. Busca em todas as bibliotecas Steam registradas (libraryfolders.vdf em qualquer disco)
$steamInstallPath = (Get-ItemProperty "HKCU:\SOFTWARE\Valve\Steam" -ErrorAction SilentlyContinue).SteamPath
if (-not $steamInstallPath) {
    $steamInstallPath = "C:\Program Files (x86)\Steam"
}
$vdfPath = Join-Path $steamInstallPath "steamapps\libraryfolders.vdf"
if (Test-Path $vdfPath) {
    $vdfContent = Get-Content $vdfPath -Raw -ErrorAction SilentlyContinue
    if ($vdfContent) {
        $matches = [regex]::Matches($vdfContent, '"path"\s+"([^"]+)"')
        foreach ($m in $matches) {
            $baseLib = $m.Groups[1].Value.Replace("\\", "\")
            $ets2Path = Join-Path $baseLib "steamapps\common\Euro Truck Simulator 2"
            $atsPath  = Join-Path $baseLib "steamapps\common\American Truck Simulator"
            if (Test-Path $ets2Path) { $gameDirs += $ets2Path }
            if (Test-Path $atsPath)  { $gameDirs += $atsPath }
        }
    }
}

# 3. Busca de varredura automatica em todos os drives do computador (C:, D:, E:, F:, etc.)
$allDrives = Get-PSDrive -PSProvider FileSystem
foreach ($drive in $allDrives) {
    $root = $drive.Root
    $candidates = @(
        "$($root)SteamLibrary\steamapps\common\Euro Truck Simulator 2",
        "$($root)SteamLibrary\steamapps\common\American Truck Simulator",
        "$($root)Program Files (x86)\Steam\steamapps\common\Euro Truck Simulator 2",
        "$($root)Program Files (x86)\Steam\steamapps\common\American Truck Simulator",
        "$($root)Steam\steamapps\common\Euro Truck Simulator 2",
        "$($root)Steam\steamapps\common\American Truck Simulator",
        "$($root)Games\Euro Truck Simulator 2",
        "$($root)Jogos\Euro Truck Simulator 2"
    )
    foreach ($cand in $candidates) {
        if (Test-Path $cand) {
            $gameDirs += $cand
        }
    }
}

$gameDirs = $gameDirs | Select-Object -Unique

if ($gameDirs.Count -eq 0) {
    Write-Host "`n[AVISO] Nenhuma pasta do ETS2/ATS foi detectada automaticamente." -ForegroundColor Yellow
    Write-Host "Por favor, digite o caminho completo da pasta do seu Euro Truck Simulator 2:" -ForegroundColor White
    $manualPath = Read-Host "(Exemplo: D:\SteamLibrary\steamapps\common\Euro Truck Simulator 2)"
    if ($manualPath -and (Test-Path $manualPath)) {
        $gameDirs += $manualPath.Trim('"')
    } else {
        Write-Host "[ERRO] Caminho invalido ou nao encontrado. Operacao cancelada." -ForegroundColor Red
        pause
        exit 1
    }
}

Write-Host "`nJogos detectados no sistema:" -ForegroundColor Green
$installedCount = 0

foreach ($gamePath in $gameDirs) {
    Write-Host " -> $gamePath" -ForegroundColor White
    
    # Pasta x64
    $winX64Dir = Join-Path $gamePath "bin\win_x64"
    if (Test-Path $winX64Dir) {
        $pluginsX64 = Join-Path $winX64Dir "plugins"
        if (-not (Test-Path $pluginsX64)) {
            New-Item -ItemType Directory -Path $pluginsX64 -Force | Out-Null
            Write-Host "    [+] Pasta criada: $pluginsX64" -ForegroundColor Cyan
        }
        $destFileX64 = Join-Path $pluginsX64 "ets2-telemetry-server.dll"
        Copy-Item -Path $sourceDllX64 -Destination $destFileX64 -Force
        Write-Host "    [OK] Plugin 64-bit instalado em: $destFileX64" -ForegroundColor Green
        $installedCount++
    }

    # Pasta x86 (se existir)
    $winX86Dir = Join-Path $gamePath "bin\win_x86"
    if ((Test-Path $winX86Dir) -and (Test-Path $sourceDllX86)) {
        $pluginsX86 = Join-Path $winX86Dir "plugins"
        if (-not (Test-Path $pluginsX86)) {
            New-Item -ItemType Directory -Path $pluginsX86 -Force | Out-Null
        }
        $destFileX86 = Join-Path $pluginsX86 "ets2-telemetry-server.dll"
        Copy-Item -Path $sourceDllX86 -Destination $destFileX86 -Force
        Write-Host "    [OK] Plugin 32-bit instalado em: $destFileX86" -ForegroundColor Green
    }
}

Write-Host "`n==========================================================" -ForegroundColor Cyan
if ($installedCount -gt 0) {
    Write-Host " SUCESSO! O plugin de telemetria foi configurado." -ForegroundColor Green
    Write-Host " Agora a telemetria funcionara automaticamente no seu jogo!" -ForegroundColor White
} else {
    Write-Host " [ALERTA] Nao foi possivel instalar o plugin." -ForegroundColor Red
}
Write-Host "==========================================================" -ForegroundColor Cyan
