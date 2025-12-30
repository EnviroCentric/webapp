param(
    [switch]$HTTP,
    [switch]$HTTPS
)

$viteConfig = ".\frontend\vite.config.js"

if ($HTTP) {
    Write-Host "Switching to HTTP mode for iOS testing..." -ForegroundColor Yellow
    
    (Get-Content $viteConfig) -replace 'basicSsl\(\) // Enable HTTPS for iOS camera access', '// basicSsl() // Disabled for iOS HTTP testing' |
    Set-Content $viteConfig
    
    (Get-Content $viteConfig) -replace 'https: true, // Enable HTTPS for iOS camera access', '// https: true, // Disabled for iOS HTTP testing' |
    Set-Content $viteConfig
    
    docker-compose restart frontend
    
    Write-Host "Server now running in HTTP mode" -ForegroundColor Green
    $ip = (ipconfig | Select-String "192\.168\.\d+\.\d+" | ForEach-Object { $_.Matches[0].Value } | Select-Object -First 1)
    Write-Host "iOS Chrome test URL: http://$ip:5173/mobile-camera-test" -ForegroundColor Cyan
    
} elseif ($HTTPS) {
    Write-Host "Switching to HTTPS mode for iOS testing..." -ForegroundColor Yellow
    
    (Get-Content $viteConfig) -replace '// basicSsl\(\) // Disabled for iOS HTTP testing', 'basicSsl() // Enable HTTPS for iOS camera access' |
    Set-Content $viteConfig
    
    (Get-Content $viteConfig) -replace '// https: true, // Disabled for iOS HTTP testing', 'https: true, // Enable HTTPS for iOS camera access' |
    Set-Content $viteConfig
    
    docker-compose restart frontend
    
    Write-Host "Server now running in HTTPS mode" -ForegroundColor Green
    Write-Host "iOS Chrome test URL: https://localhost:5173/mobile-camera-test" -ForegroundColor Cyan
    
} else {
    $ip = (ipconfig | Select-String "192\.168\.\d+\.\d+" | ForEach-Object { $_.Matches[0].Value } | Select-Object -First 1)
    Write-Host "iOS Camera Testing Mode Toggle" -ForegroundColor Cyan
    Write-Host "Current IP: $ip" -ForegroundColor White
    Write-Host ""
    Write-Host "Usage:" -ForegroundColor White
    Write-Host "  .\toggle-ios-mode.ps1 -HTTP   # Switch to HTTP (may work on iOS Chrome)" -ForegroundColor Gray
    Write-Host "  .\toggle-ios-mode.ps1 -HTTPS  # Switch to HTTPS (required for iOS)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Test URLs:" -ForegroundColor White
    Write-Host "  HTTP:  http://$ip:5173/mobile-camera-test" -ForegroundColor Gray
    Write-Host "  HTTPS: https://localhost:5173/mobile-camera-test" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Note: iOS typically requires HTTPS for camera access" -ForegroundColor Yellow
}