$ErrorActionPreference = 'Stop'
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectDir

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw 'Docker nao foi encontrado. Instale e abra o Docker Desktop e tente novamente.'
}

docker info *> $null
if ($LASTEXITCODE -ne 0) {
  throw 'O Docker Desktop nao esta iniciado. Abra-o, aguarde ficar pronto e execute INICIAR_LOCAL.bat novamente.'
}

docker compose version *> $null
if ($LASTEXITCODE -ne 0) {
  throw 'A instalacao do Docker nao inclui Docker Compose. Atualize o Docker Desktop.'
}

if (-not (Test-Path '.env.local')) {
  Copy-Item '.env.local.example' '.env.local'
  Write-Host 'Arquivo .env.local criado com credenciais locais para teste.' -ForegroundColor Cyan
}

Write-Host 'Preparando o Paracolor e o banco local. A primeira inicializacao pode demorar alguns minutos...' -ForegroundColor Cyan
docker compose --env-file .env.local -f docker-compose.local.yml up -d --build
if ($LASTEXITCODE -ne 0) {
  throw 'Falha ao construir ou iniciar o sistema. Consulte a mensagem do Docker acima.'
}

$ready = $false
for ($attempt = 1; $attempt -le 60; $attempt++) {
  try {
    $response = Invoke-WebRequest -Uri 'http://localhost:3000/api/health' -UseBasicParsing -TimeoutSec 3
    if ($response.StatusCode -eq 200) { $ready = $true; break }
  } catch { }
  Start-Sleep -Seconds 2
}

if (-not $ready) {
  Write-Warning 'Os containers iniciaram, mas a aplicacao ainda nao respondeu. Veja os detalhes com: docker compose --env-file .env.local -f docker-compose.local.yml logs -f app'
  exit 1
}

Write-Host ''
Write-Host 'Paracolor iniciado em http://localhost:3000' -ForegroundColor Green
Write-Host 'E-mail: admin@localhost'
Write-Host 'Senha:  ParacolorLocal#2026'
Write-Host 'Para encerrar, execute PARAR_LOCAL.bat. Os dados de teste serao preservados.'
Start-Process 'http://localhost:3000'
