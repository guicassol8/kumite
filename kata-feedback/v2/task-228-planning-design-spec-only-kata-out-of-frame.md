# Planejamento da #228 (completar identity.md e o canvas): kata fora de quadro, zero consultas ao kata-docs

**Found while**: `/planning-tasks #228` — estados do telão, inventário de
header/rodapé, acessibilidade do fullscreen, o breakpoint sem número e o
resíduo de decisão aberta no canvas.
**Where in kata**: nenhum ponto — a sessão não tocou kata.

## What

Observação, sem bug. Terceira sessão seguida do epic #214 em que a issue é
`stack:front` mas o trabalho é docs-only: `docs/design/` (spec, tokens,
gerador Python, pranchas) mais edição de corpos de issue no GitHub. Nenhuma
rota, schema, DI, `kata verify` ou hurl entra no quadro. **Zero consultas ao
`kata-docs` MCP**, e de novo a decisão foi imediata — não havia pergunta que
o kata pudesse responder.

O que carregou o planejamento foi leitura de código local: `common.py`,
`screens2.py`, `identity.py`, `check_tokens.py`, `blocks/src/blocks.ts` e
`editor-contract.test.tsx`. Dois achados só apareceram porque a leitura foi
até o fim dos scripts, e nenhum deles está no corpo da issue:

- **`shot.mjs` exige a Inter.** O item 7 manda tirar a Inter do gerador;
  `REQUIRED_FONTS` em `shot.mjs` lista `['Inter', '400 16px "Inter"']` e o
  script **aborta antes de escrever qualquer PNG** se a face não carregar.
  Tirar a Inter só de `common.py` quebra a geração inteira — a proteção que a
  #227 instalou funcionando exatamente como projetada, mas contra a task.
- **Import circular na 5ª checagem.** `common.py` faz
  `from check_tokens import contrast`; a checagem nova (pedida no comentário
  do review da #225) precisa ler `common.LIGHT/DARK/BLOCKS`, então o
  `import common` tem de ficar dentro da função.

Também: as referências de linha do corpo da issue (`common.py:182-195`,
`common.py:37`, `identity.md:170-172`) já estavam deslocadas — a #225 e a
#227 mexeram nos mesmos arquivos entre a auditoria e o planejamento. O
conteúdo apontado continua existindo; só não está mais naquelas linhas.

## Why it matters

Mesmo sinal de calibragem da entrada da #225, agora com uma amostra maior:
o epic #214 é uma fatia inteira do backlog que não encosta no kata. Contar
essas sessões evita ler o silêncio do `kata-feedback/` como "o kata não deu
problema" quando é "o kata não estava no caminho".

## Metrics

- Consultas ao `kata-docs` MCP: **0**. Docs lidos: 0. Custo em tokens: 0.
- Custo real do planejamento: leitura de 8 arquivos do repo + 6 corpos de
  issue via `gh`, mais duas rodadas de perguntas ao organizador (8 decisões).
- Atrito fora do kata: `gh` deu `i/o timeout` em 4 de 5 chamadas na primeira
  tentativa (o timeout de SSH/HTTPS já registrado na memória do projeto);
  o retry curto resolveu, ao custo de uma chamada de 120s perdida.
