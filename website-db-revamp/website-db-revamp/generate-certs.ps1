# PowerShell script to generate self-signed certificates for local HTTPS development

Write-Host "Generating self-signed certificates for HTTPS development..." -ForegroundColor Green

# Create certs directory if it doesn't exist
$certsDir = ".\certs"
if (!(Test-Path $certsDir)) {
    New-Item -ItemType Directory -Path $certsDir
    Write-Host "Created certs directory" -ForegroundColor Yellow
}

# Generate private key
Write-Host "Generating private key..." -ForegroundColor Yellow
& openssl genrsa -out "$certsDir\localhost.key" 2048

if ($LASTEXITCODE -ne 0) {
    Write-Host "OpenSSL not found. Trying alternative method with PowerShell..." -ForegroundColor Yellow
    
    # Alternative method using PowerShell (Windows 10/11 only)
    try {
        $cert = New-SelfSignedCertificate -DnsName "localhost", "127.0.0.1", "*.localhost" -CertStoreLocation "cert:\LocalMachine\My" -KeyAlgorithm RSA -KeyLength 2048 -Provider "Microsoft RSA SChannel Cryptographic Provider" -KeyExportPolicy Exportable -KeyUsage DigitalSignature,KeyEncipherment -Type SSLServerAuthentication
        
        # Export certificate
        $pwd = ConvertTo-SecureString -String "dev123" -Force -AsPlainText
        Export-PfxCertificate -Cert $cert -FilePath "$certsDir\localhost.pfx" -Password $pwd
        
        # Convert to PEM format (requires OpenSSL or manual conversion)
        Write-Host "Certificate generated successfully!" -ForegroundColor Green
        Write-Host "You may need to manually convert the .pfx to .pem format for Vite." -ForegroundColor Yellow
        Write-Host "Alternatively, install OpenSSL and run this script again." -ForegroundColor Yellow
        
    } catch {
        Write-Host "Failed to generate certificate: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "Please install OpenSSL or use Option 2 (mkcert) below." -ForegroundColor Yellow
    }
    return
}

# Generate certificate signing request
Write-Host "Generating certificate signing request..." -ForegroundColor Yellow
& openssl req -new -key "$certsDir\localhost.key" -out "$certsDir\localhost.csr" -subj "/C=US/ST=Dev/L=Dev/O=Dev/OU=Dev/CN=localhost"

# Generate self-signed certificate
Write-Host "Generating self-signed certificate..." -ForegroundColor Yellow
& openssl x509 -req -days 365 -in "$certsDir\localhost.csr" -signkey "$certsDir\localhost.key" -out "$certsDir\localhost.crt" -extensions v3_req -extfile @"
[v3_req]
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = *.localhost
IP.1 = 127.0.0.1
"@

Write-Host "Certificates generated successfully!" -ForegroundColor Green
Write-Host "Files created:" -ForegroundColor Cyan
Write-Host "  - $certsDir\localhost.key (private key)" -ForegroundColor White
Write-Host "  - $certsDir\localhost.crt (certificate)" -ForegroundColor White

Write-Host "`nTo use these certificates:" -ForegroundColor Yellow
Write-Host "1. Set environment variables:" -ForegroundColor White
Write-Host "   VITE_HTTPS_KEY=./certs/localhost.key" -ForegroundColor Gray
Write-Host "   VITE_HTTPS_CERT=./certs/localhost.crt" -ForegroundColor Gray
Write-Host "2. Restart your development server" -ForegroundColor White
Write-Host "3. Visit https://localhost:5173 and accept the security warning" -ForegroundColor White

Write-Host "`nNote: You may need to accept the security warning in your browser for the self-signed certificate." -ForegroundColor Cyan