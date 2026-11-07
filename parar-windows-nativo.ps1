$ErrorActionPreference = 'Stop'
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectDir

if (-not (Test-Path '.paracolor-windows-local.pid')) {
  Write-Host 'O inicializador nao encontrou um servidor local em execucao.'
  exit 0
}

$processId = [int](Get-Content '.paracolor-windows-local.pid' -Raw)
$processInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $processId" -ErrorAction SilentlyContinue
if ($processInfo -and $processInfo.CommandLine -like '* .output/server/index.mjs*') {
  Stop-Process -Id $processId -Force
  Write-Host 'Servidor Paracolor encerrado.' -ForegroundColor Green
} else {
  Write-Host 'O servidor local ja estava parado.'
}
Remove-Item '.paracolor-windows-local.pid' -Force -ErrorAction SilentlyContinue
