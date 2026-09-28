# PowerShell Installer for textc on Windows
$ErrorActionPreference = 'Stop'

# Disable PowerShell progress bar rendering to prevent Invoke-WebRequest freezes
$ProgressPreference = 'SilentlyContinue'

$Repo = "sapirrior/textc"
$Asset = "textc-windows-x64.zip"
$DownloadUrl = "https://github.com/$Repo/releases/latest/download/$Asset"

Write-Host "[+] Installing textc - AI-Native Algorithmic Compiler..." -ForegroundColor Cyan

$InstallDir = Join-Path $env:LOCALAPPDATA "textc\bin"
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

$TempZip = Join-Path ([System.IO.Path]::GetTempPath()) "textc-install.zip"
$TempExtract = Join-Path ([System.IO.Path]::GetTempPath()) "textc-extract-$([System.Guid]::NewGuid().ToString('N'))"

try {
    Write-Host "  - Target:       Windows x64" -ForegroundColor Gray
    Write-Host "  - Install path: $InstallDir\textc.exe" -ForegroundColor Gray
    Write-Host "  - Downloading:  $DownloadUrl" -ForegroundColor Gray

    # Support TLS 1.2 and TLS 1.3 for GitHub downloads
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
    } catch {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    }

    # Attempt download using Invoke-WebRequest with timeout, fallback to WebClient
    try {
        Invoke-WebRequest -Uri $DownloadUrl -OutFile $TempZip -UseBasicParsing -TimeoutSec 120
    } catch {
        Write-Host "  - Retrying download via WebClient..." -ForegroundColor Yellow
        $webClient = New-Object System.Net.WebClient
        $webClient.DownloadFile($DownloadUrl, $TempZip)
    }

    if (-not (Test-Path $TempZip) -or (Get-Item $TempZip).Length -eq 0) {
        throw "Downloaded zip archive is empty or missing."
    }

    Write-Host "  - Extracting archive..." -ForegroundColor Gray
    if (Test-Path $TempExtract) {
        Remove-Item -Recurse -Force $TempExtract
    }
    Expand-Archive -Path $TempZip -DestinationPath $TempExtract -Force

    $SourceExe = Join-Path $TempExtract "textc.exe"
    if (-not (Test-Path $SourceExe)) {
        throw "Failed to find textc.exe in the downloaded archive."
    }

    Copy-Item -Path $SourceExe -Destination (Join-Path $InstallDir "textc.exe") -Force

    Write-Host "[*] Successfully installed textc to $InstallDir\textc.exe" -ForegroundColor Green

    # Verify / Update PATH
    $UserPath = [Environment]::GetEnvironmentVariable("Path", [EnvironmentVariableTarget]::User)
    if ($UserPath -notlike "*$InstallDir*") {
        Write-Host "[i] Adding $InstallDir to User PATH..." -ForegroundColor Cyan
        [Environment]::SetEnvironmentVariable("Path", "$UserPath;$InstallDir", [EnvironmentVariableTarget]::User)
        $env:Path = "$env:Path;$InstallDir"
        Write-Host "[*] Added to PATH. (Restart your terminal if textc is not recognized immediately)." -ForegroundColor Yellow
    }

    Write-Host "Run 'textc' to get started." -ForegroundColor White
}
catch {
    Write-Host "[x] Error installing textc: $_" -ForegroundColor Red
    exit 1
}
finally {
    if (Test-Path $TempZip) {
        Remove-Item -Force $TempZip -ErrorAction SilentlyContinue
    }
    if (Test-Path $TempExtract) {
        Remove-Item -Recurse -Force $TempExtract -ErrorAction SilentlyContinue
    }
}
