# Task #230 (review): kata fora de quadro; `kata verify` + suíte completa do back rodaram mesmo assim

**Found while**: kumite #230 / PR #252 — 404, erro do router, og:image, manifest, `<html lang>`
**Where in kata**: `kata verify --strict-coverage`; ausência de consulta ao
`kata-docs` MCP

## What

Observação, não bug. O PR é 100% `front/` + `docs/design/` (gerador de SVG em
Python, alheio ao kata): `index.html`, i18n, TanStack Router, um plugin do
Vite, e2e. Nenhum arquivo sob `back/` muda. Nenhuma consulta ao `kata-docs`
MCP fez sentido nesta review — mesmo padrão de outras entradas "front-only"
já registradas.

Diferença deste review em relação ao de #168 (que decidiu pular `pnpm -r
test` do back por não valer o custo de infra): aqui rodei a suíte completa do
back mesmo assim, porque a worktree exigiu `back/.env` e um Postgres próprios
do zero (o worktree implementador já tinha os seus, mas o worktree de review
é `--detach`, separado). Uma vez que o custo de subir Postgres+migrate já
tinha sido pago para outra checagem, rodar os 605 testes do back saiu quase
de graça e serviu de confirmação extra de que o diff front-only realmente não
regrediu nada no back — mas o gate barato que efetivamente sustentou a
decisão de merge foi, de novo, `kata verify --strict-coverage`: verde, sem
infra, antes de qualquer banco existir.

## Why it matters

Mesmo ponto da entrada de #168: um gate estático que não depende de banco
nem de `.env` é o que permite a um reviewer afirmar "o back não regrediu"
antes mesmo de decidir se vale a pena montar a infra dele. Aqui a infra
acabou montada por outro motivo (rodar o e2e do front também precisa do
back de pé via `webServer` do Playwright) — então o `pnpm -r test` do back
virou um extra barato, não uma escolha cara isolada.

## Metrics

- Consultas ao `kata-docs` MCP: **0**.
- `kata verify --strict-coverage`: 1 execução, 65 arquivos, verde, <1s, sem
  banco.
- `pnpm -r test` do back: 605 testes, verde, ~61s (depois de `back/.env` +
  Postgres dedicado na worktree de review, que o e2e do front precisava de
  qualquer forma).
- Atrito atribuível ao kata: nenhum.

## Suggested fix

Nenhum. Mesmo registro de #168: `kata verify` sem exigência de infra é uma
propriedade que vale proteger, e continua se pagando mesmo quando a infra do
resto da suíte acaba sendo montada por outro motivo.
