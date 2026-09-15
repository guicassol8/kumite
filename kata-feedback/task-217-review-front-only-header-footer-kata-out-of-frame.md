# Task #217 (review): header/rodapé é 100% front, kata nunca entrou em quadro

**Found while**: kumite #217 / PR #256 — reconstrução do header e rodapé na
nova identidade (chrome carvão, menu do usuário, painel mobile, tema)
**Where in kata**: nenhum — `kata-docs` MCP não foi consultado

## What

Observação, não bug. Os 53 arquivos do diff são inteiramente `front/`
(componentes, hooks, rotas, specs de e2e, catálogos i18n, evidências) — zero
`.schema.ts`, zero rota kata, zero `.hurl`, zero arquivo sob `back/`.
Consequência direta para o review:

- **Zero consultas ao `kata-docs` MCP**, de novo — mesmo padrão já registrado
  em `task-168-review-kata-out-of-frame-verify-was-the-only-back-signal.md` e
  em várias entradas de planejamento desta mesma pasta. Nenhuma decisão do
  review dependeu de uma API do kata.
- Desta vez, diferente daquele #168, **rodar o back não foi descartado por
  custo**: a worktree da implementação já tinha um Postgres dedicado
  (`kumite-pg-217`, porta 5540) migrado e populado, então
  `pnpm --filter @kumite/back test` (616/616) e `pnpm -r typecheck` rodaram
  no mesmo fôlego que o front, sem setup extra. `kata verify` nem chegou a
  ser necessário como atalho — não porque fosse caro demais, mas porque a
  infra já estava de pé de uma sessão anterior. O padrão "gate estático
  substitui suíte cara" só aparece quando a infra realmente falta.

## Why it matters

Mais um ponto de dados para a tese que já vem se acumulando nesta pasta: uma
fração grande das tasks de front do épico #214 (header/rodapé, footer,
identidade visual) não têm nenhuma superfície kata para o review examinar. Se
o objetivo é medir o ROI do `kata-docs` MCP, o denominador relevante não é
"tasks revisadas", é "tasks que tocam back" — misturar os dois infla o número
de "consultas zero" sem dizer nada sobre o MCP em si.

## Metrics

- Consultas ao `kata-docs` MCP: **0**. Tokens gastos: **0**.
- `pnpm -r typecheck`: limpo, ~poucos segundos, 3 pacotes.
- `pnpm --filter @kumite/back test`: 616/616, ~58s — rodou porque a infra já
  existia, não por decisão de pular um gate caro.
- `pnpm --filter @kumite/front test`: 620/620, ~32s.
- `pnpm --filter @kumite/front e2e` (specs relevantes: header-footer,
  bug-report, smoke): 18/18, ~23s com `--workers=1`.
- Atrito do harness atribuível ao kata: nenhum. O único atrito real foi
  evidências de outras issues (#145, screenshots) sendo sujadas por rodar a
  suíte e2e completa de specs — resolvido com `git checkout --` antes de
  commitar, padrão já registrado em `kumite-e2e-overwrites-committed-evidence`
  (memória do usuário, não kata).

## Suggested fix

Nenhum para o kata. Sugestão de processo (fora do escopo desta pasta): ao
totalizar métricas de `kata-docs` ao longo do épico #214, marcar as entradas
"kata-out-of-frame" e excluí-las do denominador ao calcular taxa de acerto/
custo do MCP.
