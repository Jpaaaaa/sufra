# Run Electron app and capture all output
$exePath = ".\release\win-unpacked\Sufra Lite POS.exe"

Write-Host "🚀 Starting Sufra Lite POS with logging..." -ForegroundColor Green
Write-Host "📋 All logs will be displayed below:" -ForegroundColor Yellow
Write-Host "=" * 80
Write-Host ""

# Run the app and capture output
& $exePath *>&1 | ForEach-Object {
    $timestamp = Get-Date -Format "HH:mm:ss"
    Write-Host "[$timestamp] $_" -ForegroundColor Cyan
}

