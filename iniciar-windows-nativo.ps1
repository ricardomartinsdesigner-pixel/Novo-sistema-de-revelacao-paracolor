$ErrorActionPreference = 'Stop'
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectDir

if (Test-Path '.paracolor-windows-local.pid') {
  $oldPid = [int](Get-Content '.paracolor-windows-local.pid' -Raw)
  $oldProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $oldPid" -ErrorAction SilentlyContinue
  if ($oldProcess -and $oldProcess.CommandLine -like '* .output/server/index.mjs*') {
    Stop-Process -Id $oldPid -Force -ErrorAction SilentlyContinue
  }
  Remove-Item '.paracolor-windows-local.pid' -Force -ErrorAction SilentlyContinue
}

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $nodeCommand -or -not $npmCommand) {
  throw 'Instale o Node.js 22.13 ou superior para Windows e abra esta pasta novamente.'
}

$nodeVersion = (& node -p "process.versions.node").Trim().Split('.')
if ([int]$nodeVersion[0] -lt 22 -or ([int]$nodeVersion[0] -eq 22 -and [int]$nodeVersion[1] -lt 13)) {
  throw 'Este projeto requer Node.js 22.13 ou superior. Atualize o Node.js e tente de novo.'
}

try {
  $running = Invoke-WebRequest -Uri 'http://localhost:3000/api/health' -UseBasicParsing -TimeoutSec 2
  if ($running.StatusCode -eq 200) {
    Write-Host 'O Paracolor ja esta ativo em http://localhost:3000.' -ForegroundColor Green
    Start-Process 'http://localhost:3000'
    exit 0
  }
} catch { }

$port = Test-NetConnection -ComputerName '127.0.0.1' -Port 5432 -WarningAction SilentlyContinue
if (-not $port.TcpTestSucceeded) {
  throw 'PostgreSQL nao respondeu na porta 5432. Instale o PostgreSQL para Windows e inicie o servico PostgreSQL antes de continuar.'
}

if (-not (Test-Path 'node_modules/pg/package.json')) {
  Write-Host 'Instalando dependencias do Paracolor. Aguarde...' -ForegroundColor Cyan
  & npm.cmd ci --legacy-peer-deps
  if ($LASTEXITCODE -ne 0) { throw 'Falha ao instalar as dependencias. Verifique a internet e tente novamente.' }
}

if (Test-Path '.env.windows-local') {
  Write-Host 'Verificando o banco local salvo neste computador...' -ForegroundColor Cyan
  & node --env-file=.env.windows-local scripts/prepare-windows-local.mjs
} else {
  $secure = Read-Host 'Digite a senha definida para o usuario postgres na instalacao do PostgreSQL' -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { $env:PG_ADMIN_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
  try { & node scripts/prepare-windows-local.mjs }
  finally { Remove-Item Env:PG_ADMIN_PASSWORD -ErrorAction SilentlyContinue }
}
if ($LASTEXITCODE -ne 0) {
  throw 'Nao consegui conectar ao PostgreSQL. Confira a senha do usuario postgres e se o servico esta ativo.'
}

$ssrBuild = '.output/server/_ssr/ssr.mjs'
$hasSsrHandler = $false
if ((Test-Path '.output/server/index.mjs') -and (Test-Path $ssrBuild)) {
  $hasSsrHandler = [bool](Select-String -Path $ssrBuild -Pattern 'entry_server_default' -Quiet)
}
if (-not $hasSsrHandler) {
  Write-Host 'Preparando o sistema para o primeiro uso. Isso pode levar alguns minutos...' -ForegroundColor Cyan
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw 'Falha na compilacao do projeto. Confira a mensagem acima.' }
  $hasSsrHandler = $false
  if ((Test-Path '.output/server/index.mjs') -and (Test-Path $ssrBuild)) {
    $hasSsrHandler = [bool](Select-String -Path $ssrBuild -Pattern 'entry_server_default' -Quiet)
  }
  if (-not $hasSsrHandler) { throw 'A compilacao terminou, mas o manipulador SSR nao foi gerado. O servidor nao sera iniciado.' }
}

Remove-Item 'windows-local-server.log', 'windows-local-server-error.log' -Force -ErrorAction SilentlyContinue
$server = Start-Process -FilePath $nodeCommand.Source `
  -ArgumentList @('--env-file=.env.windows-local', '.output/server/index.mjs') `
  -WorkingDirectory $projectDir -WindowStyle Hidden -PassThru `
  -RedirectStandardOutput (Join-Path $projectDir 'windows-local-server.log') `
  -RedirectStandardError (Join-Path $projectDir 'windows-local-server-error.log')
Set-Content -Path '.paracolor-windows-local.pid' -Value $server.Id -NoNewline

$ready = $false
for ($attempt = 1; $attempt -le 60; $attempt++) {
  try {
    $response = Invoke-WebRequest -Uri 'http://localhost:3000/api/health' -UseBasicParsing -TimeoutSec 3
    if ($response.StatusCode -eq 200) { $ready = $true; break }
  } catch { }
  if ($server.HasExited) { break }
  Start-Sleep -Seconds 2
}

if (-not $ready) {
  if (Test-Path 'windows-local-server-error.log') { Get-Content 'windows-local-server-error.log' -Tail 30 }
  if (-not $server.HasExited) { Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue }
  Remove-Item '.paracolor-windows-local.pid' -Force -ErrorAction SilentlyContinue
  throw 'O servidor nao respondeu. Os registros estao em windows-local-server-error.log.'
}

Write-Host ''
Write-Host 'Paracolor iniciado em http://localhost:3000' -ForegroundColor Green
Write-Host 'E-mail: admin@localhost'
Write-Host 'Senha:  ParacolorLocal#2026'
Write-Host 'Para encerrar, execute PARAR WINDOWS LOCAL.bat.'
Start-Process 'http://localhost:3000'
