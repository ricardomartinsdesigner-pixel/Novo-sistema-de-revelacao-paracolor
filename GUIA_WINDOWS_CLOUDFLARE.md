# Guia simples — Paracolor no Windows com Cloudflare Tunnel

Este pacote foi preparado para Windows 10 com Docker Desktop e Cloudflare Tunnel. Ele nao exige abertura de portas no modem. O site e o banco de dados ficam no computador; a Cloudflare encaminha as visitas por uma conexao iniciada pelo proprio computador.

## Antes de comecar

- Windows 10 de 64 bits, preferencialmente 22H2, virtualizacao ativa e 8 GB de RAM.
- Docker Desktop instalado com o mecanismo WSL 2.
- Uma conta Cloudflare.
- Para um endereco proprio (por exemplo, `teste.paracolor.com.br`), o dominio `paracolor.com.br` precisa estar adicionado a Cloudflare.
- O dominio esta sendo usado pelo Wix. Preserve os registros DNS do Wix ate concluir os testes e decidir a migracao.

## A. Preparar o computador

1. Instale o WSL 2. Abra o PowerShell como administrador e execute `wsl --install`. Reinicie o computador e depois execute `wsl --update`.
2. Instale o Docker Desktop, selecione o mecanismo WSL 2 e abra o Docker Desktop.
3. No Docker Desktop, em **Settings > General**, ative a inicializacao junto com o login do Windows.
4. Extraia o ZIP para uma pasta local simples, por exemplo `C:\Paracolor`. Evite OneDrive.

## B. Preencher a configuracao

1. Clique duas vezes em `INICIAR_PARACOLOR.bat`.
2. Na primeira execucao, o programa cria `.env` e abre o Bloco de Notas.
3. Preencha:
   - `APP_DOMAIN`: hostname final ou de teste, sem `https://`, por exemplo `teste.paracolor.com.br`.
   - `POSTGRES_PASSWORD`: senha forte e exclusiva para o banco. Para evitar problemas de leitura no arquivo, use letras e numeros, sem espacos.
   - `SESSION_SECRET`: segredo aleatorio longo, com pelo menos 32 caracteres.
   - `BOOTSTRAP_ADMIN_EMAIL`: seu e-mail de administrador.
   - `BOOTSTRAP_ADMIN_PASSWORD`: senha forte para a conta administradora.
   - `BOOTSTRAP_ADMIN_NAME`: nome do administrador.
4. Salve e feche o Bloco de Notas. Mantenha `CLOUDFLARE_TUNNEL_TOKEN` vazio ate criar o tunel.
5. Execute `INICIAR_PARACOLOR.bat` novamente. Ele inicia o banco e o site.
6. Aguarde alguns minutos na primeira inicializacao. No navegador do computador, abra `http://localhost:3000/api/health`. A resposta esperada e `{"ok":true,"service":"paracolor-vps"}`.

## C. Criar o tunel permanente

1. Entre na conta Cloudflare e adicione `paracolor.com.br` como zona.
2. Confira os registros DNS importados. Copie/preserve os registros existentes do Wix, incluindo registros de e-mail (MX e TXT), antes de trocar os servidores DNS no registrador do dominio.
3. Quando os registros estiverem conferidos, troque os servidores DNS no painel do registrador do dominio para os servidores fornecidos pela Cloudflare. Isso nao altera o modem. Mantenha os registros do Wix para que o site atual continue funcionando.
4. Na Cloudflare, abra **Networking > Tunnels > Create Tunnel**. Crie um tunel e selecione o ambiente Windows ou Docker conforme a opcao mostrada.
5. Copie o token do tunel. Trate-o como uma senha: nao compartilhe e nao publique.
6. No painel do tunel, adicione uma rota de aplicacao publicada:
   - Hostname: `teste.paracolor.com.br`.
   - Service URL: `http://app:3000`.
7. Abra o `.env` no Bloco de Notas e cole o token em `CLOUDFLARE_TUNNEL_TOKEN=`. Salve.
8. Execute `INICIAR_PARACOLOR.bat` novamente. Com token preenchido, o arquivo inicia tambem o `cloudflared`.
9. Aguarde o tunel aparecer como **Healthy** na Cloudflare. Teste `https://teste.paracolor.com.br` usando o celular com o Wi-Fi desligado.

## D. Teste temporario sem mudar DNS

Para uma demonstracao temporaria, instale o `cloudflared` para Windows e, com o site iniciado, execute no PowerShell:

```powershell
cloudflared tunnel --url http://localhost:3000
```

Abra o endereco `trycloudflare.com` exibido no terminal. Mantenha o terminal aberto. O endereco e temporario, muda quando o processo reinicia e serve apenas para testes; nao use para a operacao oficial.

## E. Parar, reiniciar e fazer backup

- Para parar sem apagar dados, execute `PARAR_PARACOLOR.bat`.
- Para iniciar de novo, execute `INICIAR_PARACOLOR.bat`.
- Para ver o estado dos containers, execute `STATUS_PARACOLOR.bat`.
- Os dados do banco e os arquivos enviados ficam em volumes Docker. Faca backups pelo painel e copie os arquivos de backup para um disco externo.
- **Nao execute `docker compose down -v`**: essa opcao pode apagar os volumes do banco e dos arquivos.

## F. Trocar Wix pelo novo site

Deixe `www.paracolor.com.br` apontando para Wix durante os testes. Quando o novo sistema estiver pronto, atualize a rota e o DNS de `www` para o tunel. Preserve os registros MX/TXT usados por e-mail. O SMTP de envio do site e configurado separadamente no painel do Paracolor.

## Operacao continua

Configure o Windows para nao suspender o computador. O Docker Desktop precisa iniciar apos o login; o tunel do container volta quando o Docker inicia. Falta de energia, internet ou desligamento do computador deixa o site indisponivel. O Windows 10 ja saiu do suporte normal; mantenha as atualizacoes ESU ativas ou atualize para um Windows suportado.
