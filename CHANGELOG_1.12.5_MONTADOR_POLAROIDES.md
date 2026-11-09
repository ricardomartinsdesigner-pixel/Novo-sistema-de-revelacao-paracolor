# Paracolor 1.12.5 — Montador de Polaroides em lote

## Ferramenta de produção

- Adicionado montador em lote a Admin → Ferramentas, com acesso restrito pela proteção da área administrativa.
- A equipe seleciona 5×7 cm (Baby), 7×9 cm (Mini) ou 9×11 cm (Normal), envia até 100 fotos e baixa o lote em um ZIP organizado por formato.
- A montagem usa foto quadrada centralizada, moldura branca e legenda opcional aplicada às imagens.
- Polaroides 9×11 são produzidas em arquivo de 9×12,7 cm, com a peça 9×11 na parte superior e uma faixa preta de 1,7 cm na parte inferior.
- Fotos são processadas localmente no navegador, sem upload para o servidor.

## Liberação para o público

- Adicionada a opção Admin → Módulos → “Montador de Polaroides em lote para o público”.
- A opção começa desligada. Ao ativar, o atalho aparece em Ferramentas do site e a rota `/montador-polaroides` fica liberada; ao desligar, a página pública é bloqueada, mas a equipe continua com acesso pelo painel.
