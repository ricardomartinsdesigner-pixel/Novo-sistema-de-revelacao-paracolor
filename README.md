# Paracolor 1.12.23 — Melhorias operacionais, analytics e consultas paginadas

Esta cópia foi preparada para executar em um computador Windows com Docker Desktop e publicar o site usando Cloudflare Tunnel, sem abrir portas no modem. A aplicação roda em Node.js, persiste os dados no PostgreSQL e grava fotos/arquivos em volumes Docker.

O selo giratório da página inicial pode ser editado em **Administrador → Conteúdo do site → Home — topo**. O menu desktop mantém os links em uma linha, com espaçamento uniforme e sem divisor especial antes de Serviços.

No **Montador de Polaroides em lote**, cada miniatura abre pelo lápis o mesmo editor usado no envio normal: enquadramento por arraste e pinça, zoom, rotação, espelhamento, efeitos de cor e escrita personalizada. O arquivo exportado usa esses ajustes. A saída Normal 9 × 11 cm continua em 9 × 12,7 cm, com a faixa preta embaixo.

Na seção **Ferramentas**, a calculadora de adesivos monta folhas A4/A3 com base nas áreas vetoriais vermelhas dos PDFs de referência. A prévia mostra as marcas do laser e o resultado pode ser exportado em PDF e SVG 1:1, PNG em 300 dpi ou enviado para impressão. Margens e espaçamentos configurados ficam salvos no navegador, de forma independente por folha.

**Para instalar no Windows, siga primeiro o `GUIA_WINDOWS_CLOUDFLARE.md`.** Ele explica a configuração do `.env`, o início pelo `INICIAR_PARACOLOR.bat` e a criação do túnel. O `docker-compose.yml` desta cópia não usa o Caddy da versão para VPS.

## Início rápido no Windows

1. Extraia o ZIP para uma pasta local, por exemplo `C:\Paracolor`.
2. Execute `INICIAR_PARACOLOR.bat`. Na primeira vez, ele cria e abre o `.env` para edição.
3. Salve as senhas, domínio e e-mail de administrador no `.env`.
4. Execute `INICIAR_PARACOLOR.bat` novamente. Se o token da Cloudflare estiver preenchido, o túnel também será iniciado.
5. Consulte `GUIA_WINDOWS_CLOUDFLARE.md` para os passos completos e para manter o Wix no ar durante os testes.

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
- O HTTPS público é entregue pela Cloudflare quando o túnel está configurado; o aplicativo fica acessível localmente na porta 3000.
- Verificação de saúde: `https://SEU_DOMINIO/api/health`.

O backup inclui dados do PostgreSQL, arquivos enviados e um snapshot das configurações de execução. Esse arquivo contém dados pessoais e segredos: mantenha-o protegido. O snapshot de variáveis é apenas informativo; credenciais de ambiente devem ser configuradas novamente no `.env`/ambiente do servidor após migração. Para recuperação fora do painel, faça também uma cópia externa dos volumes Docker, que não depende do disco do servidor.

## Configurações de serviço

O Mercado Pago e o Melhor Envio podem ser configurados no painel ou por `MERCADO_PAGO_ACCESS_TOKEN` e `MELHOR_ENVIO_TOKEN` no `.env`. Para e-mails, informe os dados SMTP no painel; o envio de códigos de cadastro e recuperação de senha depende desse SMTP.

## O que foi adaptado

- Autenticação local por e-mail e senha, sessão em cookie HttpOnly, confirmação por código e recuperação de senha por link.
- Persistência de entidades em PostgreSQL e regras de acesso por proprietário/administrador na camada local.
- Envio de fotos e arquivos privados/públicos para armazenamento persistente na VPS, com links assinados para arquivos privados.
- SMTP executado em Node.js.
- Aplicação empacotada para Docker; a publicação externa usa o container `cloudflared` no perfil `public`.
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

## Cupons e campanhas

Em **Administrador → Catálogo → Cupons → Nova campanha**, escolha cupom exclusivo, cupom público ou desconto automático. O cupom exclusivo exige conta selecionada e validade, e usa uma utilização como padrão. As datas do formulário seguem o horário de Brasília. Cupons antigos continuam funcionando com as regras já cadastradas.

As campanhas aceitam mínimo de valor e de unidades nos itens elegíveis, teto do desconto e limites de uso. Os avisos públicos são opcionais, em faixa ou pop-up na página inicial. Um cupom inserido no carrinho substitui o desconto automático; sem código, vale a maior oferta automática elegível. Por padrão, as campanhas novas não acumulam desconto sobre itens que usam tabela profissional ou preço promocional.

Pedidos com limite de uso reservam o cupom ao serem criados. No pagamento online, a vigência da cobrança é de 72 horas; uma cobrança já aberta só libera a reserva após o prazo, a margem de compensação e a conferência de que não há pagamento válido em andamento. Pedidos para pagamento na loja liberam a reserva quando cancelados.


## Instalar a loja no celular

A loja oferece um convite de instalação nas páginas de navegação. O Chrome no Android pode confirmar a instalação pelo botão **Adicionar** quando o navegador disponibilizar a janela de instalação. O Safari no iPhone adiciona a loja por **Compartilhar → Adicionar à Tela de Início**. O link **Instalar aplicativo**, na coluna **Ajuda** do rodapé, permite abrir o fluxo novamente.

Na publicação, sirva a loja por HTTPS e mantenha o manifesto e os ícones públicos no mesmo domínio. O aplicativo abre a loja em uma janela própria e usa a conexão com o servidor para fotos, carrinho e pagamentos.

Veja [Pagamentos e publicação HTTPS](docs/PAGAMENTOS_E_HTTPS.md) para configurar Pix Sicoob, InfinitePay, Stone/Pagar.me e a autenticação em duas etapas.

## Acesso aos arquivos de pedidos

Os arquivos privados de um pedido precisam pertencer à conta que o criou. Os links de download são válidos para a conta que os gerou enquanto ela estiver autenticada. Após atualizar de uma versão anterior, abra o pedido e gere um novo link. Se um pedido antigo tiver arquivos importados sem proprietário ou associados a outra conta, confira a origem desses arquivos antes de solicitar o reenvio pelo cliente.
