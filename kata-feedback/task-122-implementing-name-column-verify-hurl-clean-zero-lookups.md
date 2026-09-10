# Implementando a #122: coluna `name` — kata verify e hurl passaram de primeira, zero consultas ao kata-docs

**Found while**: implementing-tasks da #122 (nome no cadastro + busca por
nome no painel de usuários), PR ainda não aberto — sessão retomada após um
crash do VSCode no meio do rebase contra `develop`.

**Where in kata**: nenhuma superfície do kata modificada diretamente. `kata
verify --strict-coverage` e `pnpm --filter @kumite/back hurl` foram
exercitados como gates em várias rodadas (incluindo depois de dois `git
commit --amend`). MCP `kata-docs` não consultado — zero queries.

## What

Três observações, nenhum bug no kata.

**1. Zero lookups no kata-docs.** O plano aprovado (fruto de uma sessão de
planejamento anterior) já tinha as convenções de schema resolvidas —
`NewUser` não omite `name` porque não tem default de banco, `UserClaimsSchema`
não muda porque nome não entra no JWT, `UuidSchema` é para id e não para busca
livre. Nada disso exigiu confirmar API do kata durante a implementação; o
trabalho real foi 100% kumite (drizzle, zod, React, Playwright).

**2. `kata verify --strict-coverage` ficou verde em toda rodada**, inclusive
depois que um rebase contra `develop` trouxe `#170` (isolamento de rede em
`header.test.tsx`) e forçou renumerar a migração de `0013` pra `0014`
(colisão com a migração de índice único da `#169`, mesclada nesse meio-tempo).
Trocar o nome/timestamp da migração e regenerar via `db:generate` não confundiu
o `kata verify` — ele não olha pra `drizzle/`, como esperado.

**3. `pnpm --filter @kumite/back hurl` passou 15/15 arquivos (306
requisições, ~29s) de primeira**, depois do ciclo completo `docker compose
down -v && up -d && db:migrate && db:seed`. O fanout de `name` nos 11 `.hurl`
que fazem `POST /auth/signup` (26 corpos) não introduziu nenhuma dependência
de ordem nova — confirma a observação já registrada de que a `#163` (cada
arquivo arruma o próprio estado) segura bem mesmo com edição em massa.

## Why it matters

Mais um data point de que, quando o plano já resolveu as decisões de schema
antes da implementação começar, a superfície do kata vira pano de fundo
silencioso — nenhum atrito, nenhuma consulta, nenhum falso positivo do
`verify`. Reforça o padrão dos relatos anteriores desta issue (ver os
`task-122-planning-*` já arquivados).

## Metrics

- Queries ao `kata-docs` MCP: **0**. Tokens gastos: **0**.
- `kata verify --strict-coverage`: 3 execuções ao longo da sessão (duas via
  hook de pre-commit em `git commit --amend`, uma manual), ~0.7–1.0s cada,
  65 arquivos, zero problemas em todas.
- `pnpm --filter @kumite/back hurl`: 29.3s, 306 requisições, 15/15 arquivos
  verdes na primeira tentativa após reset do banco.
- Fricção atribuível ao kata: **nenhuma**. Toda a fricção real da sessão foi
  de infraestrutura da worktree (Postgres de outra worktree ocupando a porta
  configurada em `.env`, volume da própria worktree com histórico de
  migração obsoleto de antes do crash) — nada do framework.

## Suggested fix (optional)

Nenhum.
