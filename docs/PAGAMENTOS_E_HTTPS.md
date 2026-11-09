# Pagamentos e publicação HTTPS

## Preparação do ambiente

1. Use uma cópia separada do banco e dos arquivos para homologação. Configure a URL pública HTTPS exata em `PUBLIC_APP_URL` (no Docker, ela é formada pelo `APP_DOMAIN`). Use um subdomínio de teste enquanto o domínio principal estiver em uso.
2. Gere uma chave de 32 bytes no computador do servidor com `node -p "require('node:crypto').randomBytes(32).toString('hex')"`. Coloque o valor em `SECURITY_SECRETS_KEY` no `.env`. Guarde a chave separadamente em local protegido. Ela é necessária para recuperar as credenciais e o segundo fator se o banco for restaurado. A chave privada, os tokens e os códigos de recuperação são dados de acesso. Use apenas o painel seguro da sua instalação para configurá-los.
3. Para testar Sicoob ou Pagar.me com credenciais de homologação, defina `PAYMENTS_SANDBOX_MODE=true` no ambiente isolado. Uma aprovação de homologação aparece com status próprio e não libera produção. Para usar credenciais de produção, desative essa variável, configure e verifique novamente o provedor e habilite-o no painel.
4. Em **Administrador → Pagamentos → Autenticação em duas etapas**, confirme sua senha e cadastre o QR Code em um aplicativo autenticador. Valide o primeiro código e guarde os códigos de recuperação de uso único. A habilitação dos novos provedores em produção exige essa proteção.

## Ativação dos provedores

Em **Administrador → Pagamentos → Integrações de pagamento**, salve as credenciais com o provedor desativado, faça a verificação e então habilite. A menor prioridade aparece primeiro no checkout. Uma cobrança permanece vinculada às credenciais e ao provedor usados na sua abertura. Ao desativar um provedor, o sistema deixa de abrir novas cobranças nele e continua consultando as anteriores.

### Pix Sicoob

Solicite à cooperativa a **API Pix de recebimento**, chave Pix da conta, Client ID, Client Secret se fornecido, endpoints oficiais e certificado de cliente aceito. Confirme escopos `cob.read` e `cob.write`, tarifa de recebimento e eventual exigência de IP fixo de saída. Selecione os endpoints da conta no formulário e configure o certificado e a chave privada correspondentes em PEM. O cliente recebe um QR Code e Pix Copia e Cola por pedido. O servidor consulta o Sicoob pelo txid usando TLS com certificado do cliente. A consulta periódica continua quando o cliente fecha a página. O Sicoob precisa confirmar o credenciamento separado de cartão Sipag para e-commerce.

- [Portal para desenvolvedores do Sicoob](https://developers.sicoob.com.br/portal/apis)

### InfinitePay

Habilite Checkout Integrado no app e gere a API Key. Informe também a InfiniteTag, sem o cifrão. A verificação no painel valida o formato localmente. A autenticação na API ocorre na criação do link de checkout. Os links aceitam Pix ou cartão e o servidor consulta `payment_check` para conferir a transação. A URL de webhook é enviada na criação da cobrança. O checkout documentado usa credencial de produção. Confirme com a InfinitePay se o seu contrato oferece ambiente separado de homologação.

- [Checkout Integrado da InfinitePay](https://ajuda.infinitepay.io/pt-BR/articles/10766888-como-usar-o-checkout-integrado-da-infinitepay)

### Stone / Pagar.me

Use a chave secreta v5 correspondente ao ambiente. Configure no painel Pagar.me a URL de webhook exibida na Paracolor. Habilite os eventos `order.paid`, `order.payment_failed`, `order.canceled` e `order.updated`. O link hospedado desta integração é de cartão de crédito à vista. O retorno dispara uma consulta autenticada ao pedido no Pagar.me antes de qualquer baixa. Valide no teste que o evento da conta inclui o link ou a descrição de referência do item e que o pedido consultado confirma moeda, valor e vínculo com o checkout.

- [Checkout e Link de Pagamento Pagar.me](https://docs.pagar.me/reference/checkout-link)
- [Webhooks Pagar.me](https://docs.pagar.me/docs/webhooks)

## Publicação e validação

- Para o computador local, siga [GUIA_WINDOWS_CLOUDFLARE.md](../GUIA_WINDOWS_CLOUDFLARE.md). Use o certificado HTTPS do domínio e o redirecionamento HTTP para HTTPS na Cloudflare. A porta do PostgreSQL deve permanecer privada. Use sistema operacional com atualizações de segurança.
- Confirme o certificado e a abertura do checkout em uma rede externa. Verifique que o endereço público é o mesmo cadastrado nos provedores. Mantenha os retornos acessíveis aos provedores, sem desafio interativo, e preserve a validação feita pela aplicação. A chave privada de autenticação do Sicoob é independente do certificado HTTPS público da loja.
- Após validar HTTPS e retornos no endereço definitivo, ative `SECURITY_HSTS=true` ou configure HSTS na Cloudflare para o host validado. Se o túnel estiver configurado para usar HTTPS até a origem local, mantenha a verificação do certificado da origem.
- Faça o teste final de criação, confirmação e reenvio da notificação no ambiente de cada conta. Confira o registro de pedidos pagos, o fluxo de vencimento e a identificação de reembolsos pelo provedor. A validação automatizada do pacote usa respostas simuladas.

- [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/)
- [Certificado Universal SSL da Cloudflare](https://developers.cloudflare.com/ssl/edge-certificates/universal-ssl/)

### Pix e cartão em provedores diferentes

Em **Administrador → Pagamentos → Integrações e configurações de pagamento**, habilite e verifique os provedores. Abra **Provedor por forma de pagamento**, marque **Separar Pix e cartão no checkout** e escolha **Sicoob** para Pix e **InfinitePay** ou **Stone / Pagar.me** para cartão. A alteração vale para pedidos novos. Uma forma selecionada fica indisponível enquanto seu provedor estiver desativado. O botão de confirmação de uma cobrança do Mercado Pago consulta a transação no provedor.

## Backup no painel

O painel gera arquivos cifrados com extensão `.parabackup`. Configure uma chave exclusiva de 64 caracteres hexadecimais em `BACKUP_ENCRYPTION_KEY` e guarde-a separadamente, junto do material de recuperação da instalação. Sem uma chave dedicada, a leitura do arquivo usa uma chave derivada de `SESSION_SECRET`. Preserve a chave usada para cada backup antes de trocar a configuração. A restauração também abre backups antigos `.tar.gz`. Para recuperar em outro servidor as credenciais de pagamento e a autenticação em duas etapas, mantenha também a `SECURITY_SECRETS_KEY` original. Faça a primeira restauração em uma instalação de teste.
