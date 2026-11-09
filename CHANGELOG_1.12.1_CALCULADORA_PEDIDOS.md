# Paracolor 1.12.1 — Calculadora de pedidos

- Adicionada a calculadora pública em `/simulador`, com quantidades de todos os formatos ativos de Revelação e Polaroides.
- O cálculo reutiliza o catálogo atual, os preços unitários, as faixas e os grupos de contagem do site; as faixas são aplicadas pelo mesmo cálculo usado no carrinho.
- O resumo apresenta quantidade, valor unitário, faixa e subtotal por formato, total geral e botão para copiar o orçamento.
- Adicionado acesso à calculadora pelo rodapé, pelo pop-up Ferramentas e pelas páginas de Revelação e Polaroides.
- Adicionada uma aba de calculadora combinada em **Administrador → Preços e descontos**, para a equipe montar orçamentos com formatos mistos e copiar o resumo para o cliente.
- Incluído o interruptor **Calculadora de preços por quantidade** em **Administrador → Módulos → Compra e atendimento**.
- O orçamento é estimado pelos preços atuais do catálogo. O carrinho ainda confirma frete, bordas/acabamentos e cupons ou campanhas aplicáveis.

## Validação

- O pacote de origem não traz `node_modules`; não foi possível executar build local porque `vite` não está instalado.
- Testes automatizados não foram executados nesta alteração.
