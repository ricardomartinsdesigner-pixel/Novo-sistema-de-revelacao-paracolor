# Adaptação da Paracolor para VPS

## O que mudou

- Saída de hospedagem Worker/Cloudflare e entrada de servidor Node.js com Nitro e TanStack Start.
- Substituição do SDK/backend Base44 por uma API local de compatibilidade para entidades e autenticação.
- Persistência no PostgreSQL; entidades são armazenadas como registros JSONB com metadados do proprietário e datas.
- Upload local de imagens, PDFs e vídeos em um volume persistente; uploads privados usam URL assinada temporária.
- SMTP passou a usar sockets `node:net`/`node:tls` para rodar no servidor Node.
- Mercado Pago e Melhor Envio continuam usando os tokens armazenados no painel ou as variáveis de ambiente.
- Docker Compose inicia PostgreSQL, aplicação e Caddy com HTTPS.

## Controles adicionados

- Senhas com hash `scrypt` e cookie de sessão HttpOnly, SameSite=Lax e Secure em produção.
- Confirmação de cadastro por código, recuperação por link e limite de tentativas nos endpoints de autenticação.
- Regras de leitura/gravação por proprietário e papel aplicadas no servidor.
- Criação da conta administrativa inicial a partir de variáveis de ambiente.
- Conferência da assinatura dos arquivos enviados conforme o MIME declarado.
- Validação de origem nos endpoints de dados, autenticação e upload.
- Autorização administrativa na conclusão automática de prazos e lista fechada de status de pedido.

## Inicialização e cópia dos dados

Consulte o `README.md` para preparar `.env` e iniciar com Docker Compose. A primeira instalação usa banco vazio. Para migração de uma loja em funcionamento, faça exportação das entidades, cópia dos arquivos, conversão das referências `file_uri` e importação para o PostgreSQL antes de alterar o domínio. Os esquemas originais foram guardados em `docs/entity-schema-reference/` como referência; ainda não existe importador automático do Base44.

## Recursos ainda não migrados

- MFA e autenticação social.
- Exportação/importação automática de clientes, pedidos, catálogo e imagens do Base44.
- Teste real de webhook, frete, SMTP, cobrança ou publicação, pois as credenciais e o ambiente da loja não foram fornecidos.

## Verificação feita

- `npm run build`: concluído para Node/Nitro.
- `npm run lint`: concluído sem erros.
- `npm ci --dry-run --legacy-peer-deps`: lockfile conferido.
- Docker Compose não foi executado neste ambiente porque o binário Docker não está instalado. A implantação ainda precisa ser validada na VPS com domínio, DNS, e-mail e credenciais reais.

O build reporta um chunk de HEIC com mais de 500 kB; isso é um aviso de tamanho do pacote do navegador e não impediu a compilação.
