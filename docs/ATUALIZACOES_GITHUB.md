# Atualizações pelo GitHub

O painel **Administrador → Configurações → Atualizações do sistema** consulta a última Release pública do repositório e oferece **Buscar atualização** e **Instalar**. O pacote baixado contém somente o build da aplicação; antes de instalá-lo, o servidor confere SHA-256. O sistema cria uma cópia do build anterior e reinicia o serviço.

Na configuração de prazos, o botão **Buscar feriados nacionais** consulta a lista do ano na BrasilAPI e combina os resultados com os feriados já cadastrados. A lista permite remover datas importadas ou manuais. Feriados estaduais e municipais devem ser informados manualmente.

## Publicação de uma versão

1. Atualize a versão em `package.json` e `package-lock.json`.
2. Faça commit das alterações na branch principal, incluindo `.github/workflows/release.yml`.
3. Publique uma tag com o mesmo número, por exemplo `v1.0.3`. O workflow executa testes, lint e build; se tudo passar, publica os arquivos necessários para o atualizador.
4. Configure `APP_VERSION=1.0.3` no `.env` do servidor ao instalar essa versão.
5. O painel compara a versão instalada com a Release mais recente e oferece a atualização quando houver uma versão superior.

Para próximas correções, incremente a versão (por exemplo, `1.0.4`) e publique uma tag nova correspondente. Não reutilize tags antigas.

## Reinício por ambiente

- Docker Compose: o volume `app_output` mantém o build atualizado entre reinicializações; a política `restart: unless-stopped` inicia novamente o processo.
- Linux instalado diretamente: use o serviço systemd de `deploy/paracolor.service` como referência e ajuste usuário, diretório e arquivo de ambiente. O systemd reinicia o processo após a instalação.
- Windows local: o inicializador nativo usa `scripts/restart-windows-update.ps1` para trocar o build após o encerramento do processo e iniciar o servidor novamente.

Evite iniciar um servidor Linux de produção manualmente no terminal sem um supervisor; o processo precisa reiniciar após a atualização. O banco PostgreSQL, uploads, `.env` e segredos não são incluídos no pacote de atualização.

## Retorno em caso de falha

O build anterior fica em `data/updates` (ou no caminho configurado em `UPDATE_STATE_DIR`). Se o novo build não iniciar, pare o serviço e restaure o diretório `.output` da cópia mais recente. Faça também backup independente do PostgreSQL e da pasta de uploads; a cópia do build não substitui backup dos dados.
