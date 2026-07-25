[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ParameterName,
    [string]$Region = "us-west-2"
)

$ErrorActionPreference = "Stop"

$awsCommand = Get-Command aws -ErrorAction SilentlyContinue
$awsExecutable = if ($awsCommand) { $awsCommand.Source } else { "C:\Program Files\Amazon\AWSCLIV2\aws.exe" }
if (-not (Test-Path $awsExecutable)) {
    throw "AWS CLI is required. Install it and authenticate before continuing."
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker is required to read the local PostgreSQL container."
}

$query = @'
SELECT row_to_json(seed)::text
FROM (
  SELECT id, email, hashed_password, first_name, last_name, phone,
         is_active, is_superuser, must_change_password,
         password_set_at, created_at, updated_at
  FROM users
  WHERE id = 1
) AS seed;
'@

$payload = $query | docker compose exec -T db sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -At' 2>$null
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($payload)) {
    throw "Could not read users.id=1 from the local database. Ensure Docker Compose is running."
}

$user = $payload | ConvertFrom-Json
if ($user.id -ne 1 -or -not $user.is_active -or -not $user.is_superuser) {
    throw "Preflight failed: user 1 must exist, be active, and already be a superuser."
}

# Base64 prevents Windows native-argument quoting from altering the JSON. The
# value is still encrypted by SSM and held only in memory locally.
$encodedPayload = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($payload.Trim()))
& $awsExecutable ssm put-parameter `
    --region $Region `
    --name $ParameterName `
    --type SecureString `
    --tier Standard `
    --overwrite `
    --value $encodedPayload | Out-Null

if ($LASTEXITCODE -ne 0) {
    throw "Failed to store the encrypted bootstrap parameter."
}
$payload = $null
$encodedPayload = $null

Write-Host "User 1 passed preflight and was stored in encrypted SSM parameter: $ParameterName"
Write-Host "Delete this parameter immediately after the production bootstrap is verified."
