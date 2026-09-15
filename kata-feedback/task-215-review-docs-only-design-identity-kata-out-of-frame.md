# Review da #215 (PR #224): PR só de docs/assets de design — kata fora de quadro, zero consultas

**Found while**: reviewing-tasks #224 (issue #215 — identidade visual v1 em `docs/design/`)
**Where in kata**: nenhum módulo tocado; `kata verify --strict-coverage` rodou apenas como gate (`pnpm check`)

## What

O PR adiciona `docs/design/` (spec, tokens DTCG, SVG/PNG do logo, artboards do
canvas, gerador Python/Node) e duas linhas em `AGENTS.md`/`front/AGENTS.md`.
Nenhuma linha em `back/`. Os achados do review foram todos no gerador
(caminhos de saída de rascunho, `require` absoluto da home do autor,
newline no `canvas.json`) e num hex desatualizado nos prompts de imagem —
nada que um lint do kata pudesse ver ou que a kata-docs pudesse responder.

## Why it matters

Mais um ponto na série "task fora do quadro do kata": o único sinal do kata
neste review foi `kata verify` verde dentro do `pnpm check`, num tree sem
mudança de back. Confirma que a superfície do kata é irrelevante para PRs de
docs/design, e que o custo de ter o harness (hook Stop rodando o ladder
inteiro, `verify` + vitest do back com Postgres) é pago mesmo quando o diff
não toca `back/`.

## Metrics

- Consultas à kata-docs MCP: 0. Docs do kata lidos: 0.
- Turnos gastos com kata: 0 além do `pnpm check` (Acceptance da issue exige
  que continue verde).
- Fricção: precisei subir um Postgres descartável (porta 5441) só para o
  `pnpm check` rodar vitest do back numa PR sem código — inerente ao gate,
  não ao kata.

## Suggested fix (optional)

Nenhum no kata. No lado do kumite, um gate condicional ao path (`back/**`
mudou?) evitaria o Postgres/vitest do back em PRs só de docs — fora do
escopo deste review, fica como observação.
