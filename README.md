# Paracolor — versão para VPS

Esta cópia foi adaptada para executar em uma VPS sem o backend Base44. A aplicação roda em Node.js, persiste os dados no PostgreSQL e grava fotos/arquivos em um volume local. O Docker Compose também inicia o Caddy, que publica o site com HTTPS automático.

## Requisitos

- VPS Ubuntu 22.04 ou superior, com pelo menos 2 GB de RAM recomendados.
- Docker Engine e Docker Compose Plugin.
- Um domínio apontado para o IP público da VPS.
- Portas TCP 80 e 443 liberadas no firewall da VPS e do provedor.

## Primeira instalação

1. Envie a pasta do projeto para a VPS ou clone o repositório.
2. Copie `.env.example` para `.env`.
3. Edite `.env`: informe `APP_DOMAIN`, e-mail do primeiro administrador e senhas fortes para PostgreSQL, sessão e conta administrativa.
4. Gere um segredo aleatório para a sessão, por exemplo: `openssl rand -hex 32`.
5. Inicie a aplicação: `docker compose up -d --build`.
6. Acompanhe a inicialização com `docker compose logs -f app`.
7. Abra `https://SEU_DOMINIO` e entre com o e-mail e a senha de administrador definidos em `.env`.
8. No painel, configure SMTP em **Mensagens** antes de habilitar cadastro de clientes, recuperação de senha ou notificações.

O primeiro acesso cria as tabelas necessárias e a conta administrativa inicial. Depois da criação, alterar `BOOTSTRAP_ADMIN_PASSWORD` não redefine a senha já gravada no banco. Para trocar a senha, use o fluxo de recuperação ou a administração de usuários.

## Testar localmente no Windows sem WSL ou Docker

Instale [Node.js 22.13 ou superior](https://nodejs.org/en/download) e [PostgreSQL 16 ou superior para Windows](https://www.postgresql.org/download/windows/). Na instalação do PostgreSQL, mantenha a porta padrão `5432` e anote a senha do usuário `postgres`. Extraia o ZIP para uma pasta nova, preferencialmente `C:\ParacolorVPS` (fora do OneDrive), e execute `INICIAR SISTEMA LOCAL.bat`. Na primeira execução, informe essa senha; o inicializador cria o banco `paracolor`, instala as dependências, compila o projeto e abre `http://localhost:3000`.

Credenciais locais iniciais: `admin@localhost` / `ParacolorLocal#2026`. A configuração e os arquivos de teste ficam na própria pasta do projeto. Use `PARAR WINDOWS LOCAL.bat` para encerrar o servidor. Para limpar o teste, remova `.env.windows-local`, o banco `paracolor` no PostgreSQL e a pasta `data/uploads`.

Este modo fica restrito ao computador local e não publica o site na internet. A senha do PostgreSQL fica salva em `.env.windows-local` para facilitar as próximas inicializações; mantenha esse arquivo privado e não o envie a terceiros.

## Testar localmente com Docker Desktop

Se preferir Docker, instale e abra o Docker Desktop para Windows com WSL 2 habilitado e execute `INICIAR_LOCAL.bat`. Ele usa o PostgreSQL em container e abre `http://localhost:3000`. Use `PARAR_LOCAL.bat` para parar sem apagar os dados dos volumes. Esse modo não é necessário para o inicializador Windows nativo acima.

## Atualizar o sistema

As atualizações podem ser consultadas e instaladas no painel em **Administrador → Configurações → Atualizações do sistema**. O painel aplica Releases públicas do GitHub, valida SHA-256, preserva uma cópia do build anterior e reinicia o processo conforme o ambiente. A primeira publicação do repositório e a criação das Releases precisam ser feitas no GitHub; consulte [docs/ATUALIZACOES_GITHUB.md](docs/ATUALIZACOES_GITHUB.md).

Para atualizar manualmente, faça backup e execute `docker compose up -d --build`. Banco, uploads, build persistido e estado do atualizador ficam em volumes separados.

## Dados e arquivos

- PostgreSQL: serviço `db`, volume Docker `postgres_data`.
- Fotos e documentos enviados: volume Docker `uploads_data`, no caminho `/var/lib/paracolor/uploads` dentro do container.
- Backups completos: volume Docker `backups_data`, no caminho `/var/lib/paracolor/backups`. No painel **Administrador → Configurações → Backup completo e restauração**, é possível baixar um arquivo com o banco, uploads e snapshot das configurações; configurar backup diário pelo horário de Brasília e retenção de 1 a 60 cópias; e restaurar um arquivo após confirmação. Antes de restaurar, o sistema salva o estado atual para recuperação.
- Certificados HTTPS e configuração do Caddy: volumes `caddy_data` e `caddy_config`.
- Verificação de saúde: `https://SEU_DOMINIO/api/health`.

O backup inclui dados do PostgreSQL, arquivos enviados e um snapshot das configurações de execução. Esse arquivo contém dados pessoais e segredos: mantenha-o protegido. O snapshot de variáveis é apenas informativo; credenciais de ambiente devem ser configuradas novamente no `.env`/ambiente do servidor após migração. Para recuperação fora do painel, faça também uma cópia externa dos volumes Docker, que não depende do disco do servidor.

## Configurações de serviço

O Mercado Pago e o Melhor Envio podem ser configurados no painel ou por `MERCADO_PAGO_ACCESS_TOKEN` e `MELHOR_ENVIO_TOKEN` no `.env`. Para e-mails, informe os dados SMTP no painel; o envio de códigos de cadastro e recuperação de senha depende desse SMTP.

## O que foi adaptado

- Autenticação local por e-mail e senha, sessão em cookie HttpOnly, confirmação por código e recuperação de senha por link.
- Persistência de entidades em PostgreSQL e regras de acesso por proprietário/administrador na camada local.
- Envio de fotos e arquivos privados/públicos para armazenamento persistente na VPS, com links assinados para arquivos privados.
- SMTP executado em Node.js.
- Aplicação empacotada para Docker e publicada pelo Caddy com TLS.
- Mercado Pago e Melhor Envio continuam integrados por configuração segura do servidor.
- Releases GitHub com atualização administrável e checksum SHA-256.
- Prazos independentes para revelação e polaroides em dias úteis, horas ou minutos.
- Busca automática de feriados nacionais; feriados estaduais e municipais podem ser incluídos manualmente.

## Limites desta migração

- A base inicia vazia. Os dados que hoje estão no Base44 não são exportados automaticamente; é necessário exportá-los e preparar uma importação antes de trocar o site em produção.
- Referências de fotos/arquivos antigas apontam para o armazenamento do Base44. Os arquivos precisam ser copiados para a VPS e as referências importadas precisam ser atualizadas para `vps:<id>`.
- Login social e autenticação em duas etapas (MFA) ainda não foram migrados.
- O modelo de dados local usa registros JSONB genéricos no PostgreSQL. Antes de receber dados de clientes em produção, revise autorização, rate limit, logs, backups e retenção de arquivos no seu ambiente.
- Esta pasta é um ponto de partida implantável; não foi possível validar integrações reais sem domínio, credenciais de SMTP/Mercado Pago/Melhor Envio e uma VPS configurada.

## Comandos úteis

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f app
docker compose restart app
docker compose down
```

`docker compose down` preserva os volumes. **Não use `docker compose down -v`** se quiser manter banco, fotos e certificados.
