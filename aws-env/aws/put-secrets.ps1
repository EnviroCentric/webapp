[CmdletBinding()]
param(
    [string]$AppName = "enviro-centric",
    [string]$Region = "us-west-2",
    [switch]$SkipGoogleKey
)

$ErrorActionPreference = "Stop"

function New-RandomSecret {
    $bytes = [byte[]]::new(48)
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function Read-SecretValue([string]$Prompt) {
    $secure = Read-Host $Prompt -AsSecureString
    return [System.Net.NetworkCredential]::new('', $secure).Password
}

function Put-Secret([string]$Name, [string]$Value) {
    & $script:AwsExecutable ssm put-parameter --region $Region --name $Name --type SecureString --tier Standard --overwrite --value $Value | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Failed to write $Name" }
}

$awsCommand = Get-Command aws -ErrorAction SilentlyContinue
$script:AwsExecutable = if ($awsCommand) { $awsCommand.Source } else { "C:\Program Files\Amazon\AWSCLIV2\aws.exe" }
if (-not (Test-Path $script:AwsExecutable)) {
    throw "AWS CLI is required."
}

$prefix = "/$AppName"
$databasePassword = New-RandomSecret
Put-Secret "$prefix/database/password" $databasePassword
Put-Secret "$prefix/jwt/access" (New-RandomSecret)
Put-Secret "$prefix/jwt/refresh" (New-RandomSecret)
Put-Secret "$prefix/admin-creation" (New-RandomSecret)

if (-not $SkipGoogleKey) {
    $googleServerKey = Read-SecretValue "Server-restricted Google Places key"
    Put-Secret "$prefix/google/server" $googleServerKey
    $googleServerKey = $null
}

$databasePassword = $null
Write-Host "Encrypted production parameters created beneath $prefix. Secret values were not printed."
