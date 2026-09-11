# Task #175: implementação 100% front — `kata verify` rodou 6× sem nada para dizer

**Found while**: #175 (workspace e cache sobrevivem ao logout) — etapa de
implementação
**Where in kata**: `kata verify` (via hook pre-commit), `kata-docs` MCP (ausente)

## What

Observação, sem bug. A task inteira viveu em `front/`: chave do
`localStorage`, `queryClient` do React Query, hook de autosave e specs
Playwright. Nenhuma rota, schema, DI, JWT ou migration foi tocada — `back/`
não mudou em um único byte.

Consequências para a superfície kata:

- **`kata-docs` MCP**: ausente da sessão de novo (os MCPs conectados eram
  ClickUp, Figma e Gmail). Não fez falta: zero perguntas sobre kata
  apareceram durante a implementação.
- **`kata verify`**: rodou em toda tentativa de commit (o hook roda a ladder
  inteira), 6 execuções, sempre `no problems found (65 files checked)`, sempre
  em ~0.7–1.8s. Correto, barato, e sem nada a dizer sobre uma mudança que não
  tocou `back/`.

O que realmente custou tempo nesta task não teve relação com kata: uma
reprodução e2e que só falhava sem recarregar o documento (o `queryClient`
nasce no escopo de módulo, então qualquer `goto` limpava o cache e escondia o
bug), e depois cinco specs que semeavam `localStorage` com a chave antiga.

## Why it matters

Terceiro registro seguido de "kata fora de quadro" numa task de front. O sinal
acumulado é que a ladder de gates não distingue mudança de `front/` de mudança
de `back/`: `kata verify` é rápido o suficiente para isso não doer, mas o
mesmo hook também roda a suíte inteira do `back/` (601 testes, ~90–226s) em
commits que não tocam `back/`. Numa máquina apertada isso foi o gargalo real
da sessão.

## Metrics

- **Consultas ao `kata-docs`**: 0 (servidor ausente; nenhuma pergunta surgiu).
- **Tokens gastos com kata**: ~0 do total da task. Nenhum round-trip de
  documentação foi necessário nem teria pago.
- **`kata verify`**: 6 execuções, 0 achados, ~0.7–1.8s cada. Nenhum
  falso-positivo.
- **Fricção do hook (não-kata)**: a suíte do `back/` rodou em todos os 5
  commits sem nenhum arquivo de `back/` ter mudado. Uma execução levou 226s
  sob contenção de CPU e falhou 12 testes de `password-reset` por
  `Test timed out in 5000ms` — starvation, não regressão; a mesma suíte passou
  em 92s com a máquina livre.
- **Armadilha auto-infligida que vale registrar**: tentei aliviar a memória
  exportando `VITEST_MAX_WORKERS=2`, o que anulou o `fileParallelism: false`
  do `back/vitest.config.ts` e quebrou 57 testes que truncam as mesmas tabelas.
  Não é problema do kata, mas mostra como o sinal "testes do back falhando"
  chega ambíguo: contenção de CPU, paralelismo e regressão real se parecem.

## Suggested fix (optional)

Nada a mudar no kata. Se algo, é do lado kumite: fazer o hook de pre-commit
escolher a suíte pelo que está staged (`back/` mudou → testa `back/`), que é
onde o custo está de fato. Fica como observação, não como pedido — não abri
issue porque está fora do escopo do #175.
