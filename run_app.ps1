Start-Process "C:\Program Files\Google\Chrome\Application\chrome.exe" -ArgumentList '--app="file:///C:/Apps/atk/www/index.html"'
Start-Sleep -Seconds 1
$code = @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
    [DllImport("user32.dll")]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@
Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue

$processes = Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -match "ATK" }
if ($processes.Count -gt 0) {
    if ($processes.Count -gt 1) {
        # filter to just the app one if possible, often the last launched or highest memory etc, but [0] is fine for now
    }
    $hwnd = $processes[0].MainWindowHandle
    [Win32]::SetWindowPos($hwnd, [IntPtr]::Zero, -2520, 224, 600, 1024, 0x0040)
    [Win32]::ShowWindow($hwnd, 3)
}
