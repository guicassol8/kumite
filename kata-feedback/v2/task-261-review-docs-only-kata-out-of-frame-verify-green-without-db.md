# Task #261 (review): docs-only PR, kata fora de quadro — `verify` verde sem banco sustentou pular o `pnpm -r test` do back

**Found while**: kumite #261 / PR #263 — documentar o gate ladder como
contrato manual em `docs/workflow.md`
**Where in kata**: `kata verify --strict-coverage`; ausência de consulta ao
`kata-docs` MCP

## What

Observação, não bug. O diff inteiro é `docs/workflow.md` +
`kata-feedback/task-261-implementing-*.md` — nenhum arquivo sob `back/`,
`front/` ou `blocks/`. O texto adicionado *nomeia* `kata verify
--strict-coverage` como um dos três comandos do gate ladder, mas é uma
citação literal do que já existe em `.claude/hooks/stop.sh`, não uma
integração nova com o framework.

Consequência para o review:

- **Zero consultas ao `kata-docs` MCP.** Não houve nenhuma API do kata para
  conferir — só prosa descrevendo um script já existente.
- **`kata verify` rodou mesmo assim (65 arquivos, verde, sem banco, sem
  `.env`) e foi o que permitiu decidir não montar Postgres na worktree só
  para rodar `pnpm -r test`.** A suíte de back exige DB (462 testes falharam
  por `ECONNREFUSED :5433` na primeira tentativa, sem Postgres subido nesta
  worktree); como o PR não toca `back/`, o `verify` estático já bastava como
  prova de "nada de back regrediu", e o próprio hook `stop.sh` concorda:
  seu guard de escopo (`git status -- back front blocks package.json`) já
  teria pulado a ladder inteira para este diff.
- Mesmo padrão do feedback de #168 (review): `verify` sem infra é o gate que
  sobra quando o diff não toca o pacote que ele cobre.

## Why it matters

Reforça o sinal já registrado em #168: um gate estático que não precisa de
banco nem de `.env` é o que torna barato declarar "back intocado" num review
de diff que não é back. Aqui o caso é ainda mais extremo — nem front, nem
back, só docs — e mesmo assim o `verify` rodou de graça e sustentou a
decisão sozinho.

## Metrics

- Consultas ao `kata-docs` MCP: **0**.
- `kata verify --strict-coverage`: 1 execução, 65 arquivos, verde.
- `pnpm -r typecheck`: verde (exigiu só `pnpm install` na worktree, sem
  relação com kata).
- `pnpm -r test` do back: tentado, falhou por Postgres ausente na worktree
  (462/616 testes); não refeito com banco próprio porque o diff não justifica
  o custo — não é evidência mandatória para um PR sem `front/`/`back/`
  (regra de `reviewing-tasks`).
- Atrito atribuível ao kata: nenhum.

## Suggested fix

Nenhum. Mais um data point para a hipótese já registrada em #168: proteger a
propriedade de `kata verify` rodar sem infra vale mais do que parece.
