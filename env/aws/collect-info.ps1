[CmdletBinding()]
param()

$ErrorActionPreference = "Continue"

function Show-Tool {
    param([string]$Name, [string[]]$VersionArgs)
    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if (-not $command) {
        Write-Host "[MISSING] $Name"
        return $false
    }
    $version = & $Name @VersionArgs 2>&1 | Select-Object -First 1
    Write-Host "[OK] $Name - $version"
    return $true
}

Write-Host "AWS hosting prerequisite check"
$awsReady = Show-Tool "aws" @("--version")
Show-Tool "docker" @("--version") | Out-Null
Show-Tool "node" @("--version") | Out-Null
Show-Tool "npm" @("--version") | Out-Null

if ($awsReady) {
    Write-Host "`nConfigured AWS identity (contains no credentials):"
    aws sts get-caller-identity --output table
    Write-Host "`nAWS configuration sources (secret values are masked by the CLI):"
    aws configure list
}

Write-Host "`nStill needed from you:"
Write-Host "- Exact Squarespace domain and access to Settings > Domains > DNS Settings"
Write-Host "- Billing notification email"
Write-Host "- Browser-restricted and server-restricted Google Places API keys"
Write-Host "- An ACM certificate in us-east-1 validated through Squarespace DNS"
