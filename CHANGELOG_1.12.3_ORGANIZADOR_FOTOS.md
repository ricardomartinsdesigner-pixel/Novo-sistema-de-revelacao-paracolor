# Paracolor 1.12.3 — Organizador de fotos repetidas

- Criada comparação local de imagens usando SHA-256 para duplicatas exatas e assinatura visual dHash para sugerir imagens parecidas; não usa API paga e não envia imagens durante a análise.
- Integrada a revisão de duplicadas ao envio de Revelação e Polaroides: quando há correspondências, o cliente ou atendente pode filtrar todas, duplicadas, parecidas e únicas, selecionar imagens e manter uma cópia por grupo exato.
- Fotos parecidas nunca são removidas automaticamente. Ao remover uma da seleção, o arquivo original no aparelho permanece intacto.
- Adicionada a ferramenta independente em **Ferramentas**, com botões para seguir para Revelação normal ou Polaroides e levar as fotos selecionadas ao editor.
- Adicionado acesso do mesmo organizador em **Administração → Ferramentas** e um controle para ativar ou desativar a ferramenta em **Administração → Módulos → Recursos e destaques**.
- Assinaturas digitais ficam no rascunho do pedido para detectar duplicatas em novos lotes enviados ao mesmo pedido.

## Limitações e validação

- A assinatura visual sugere imagens semelhantes, não reconhece semanticamente a mesma pessoa ou cena; semelhanças são sempre apresentadas para revisão manual.
- O ZIP foi verificado após a montagem. Não foi possível compilar neste ambiente porque `vite` não está instalado; testes automatizados não foram executados nesta alteração.
