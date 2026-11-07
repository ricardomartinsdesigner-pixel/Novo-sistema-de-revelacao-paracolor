param(
  [Parameter(Mandatory = $true)][string]$ProjectDir,
  [Parameter(Mandatory = $true)][int]$ParentPid,
  [Parameter(Mandatory = $true)][string]$BackupDir
)

$ErrorActionPreference = 'Stop'
for ($attempt = 0; $attempt -lt 90; $attempt++) {
  if (-not (Get-Process -Id $ParentPid -ErrorAction SilentlyContinue)) { break }
  Start-Sleep -Milliseconds 500
}

$outputDir = Join-Path $ProjectDir '.output'
$pendingDir = Join-Path $ProjectDir '.output-update-pending'
$stateDir = Join-Path $ProjectDir 'data\updates'
$logOut = Join-Path $ProjectDir 'windows-local-server.log'
$logErr = Join-Path $ProjectDir 'windows-local-server-error.log'
$versionFile = Join-Path $stateDir 'pending-version'

if (Test-Path $outputDir) { Move-Item -LiteralPath $outputDir -Destination $BackupDir }
Move-Item -LiteralPath $pendingDir -Destination $outputDir
if (Test-Path $versionFile) {
  Move-Item -LiteralPath $versionFile -Destination (Join-Path $stateDir 'current-version') -Force
}
$node = (Get-Command node.exe -ErrorAction Stop).Source
$server = Start-Process -FilePath $node -ArgumentList @('.output/server/index.mjs') -WorkingDirectory $ProjectDir -WindowStyle Hidden -PassThru -RedirectStandardOutput $logOut -RedirectStandardError $logErr
Set-Content -Path (Join-Path $ProjectDir '.paracolor-windows-local.pid') -Value $server.Id -NoNewline
