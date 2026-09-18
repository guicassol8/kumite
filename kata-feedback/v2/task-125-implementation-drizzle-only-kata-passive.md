# Implementação #125: task 100% drizzle, kata só como portão — zero lookups no kata-docs

**Found while**: #125 — índice único em `event_codes.university` (implementação)
**Where in kata**: `kata verify --strict-coverage`, `pnpm hurl`

## What

Observação, não bug. A task inteira viveu abaixo da superfície do kata: um
`uniqueIndex` no schema drizzle, uma migration gerada pelo `drizzle-kit` e um
teste vitest contra o Postgres real. Nenhuma rota, schema zod, middleware ou
peça de DI mudou — por construção, já que o Acceptance era "o banco recusa a
segunda linha".

Consequência prática: **zero consultas ao `kata-docs` MCP** durante a
implementação, pelo mesmo motivo já registrado no feedback de planejamento
desta mesma issue (`task-125-planning-drizzle-only-kata-not-in-frame.md`) — não
havia pergunta de framework a fazer. O kata apareceu só como portão:

- `kata verify --strict-coverage` — verde nas duas execuções (manual e no
  pre-commit), 65 arquivos, 0.8s. Rápido o bastante para não ser sentido no
  loop.
- `pnpm hurl` — 15 arquivos, 301 requests, 9.5s, tudo verde de primeira contra
  o servidor da worktree. Rodou sem nenhum ajuste apesar de a task ter mudado
  o formato dos dados de `event_codes` (uma linha por universidade agora é
  invariante de banco), o que é um sinal bom: os `.hurl` não estavam acoplados
  à duplicata que o índice passou a proibir.

O único atrito real do dia não foi do kata e sim do próprio drizzle-kit: a
migration falhou com a saída **truncada** — `drizzle-kit migrate` imprimiu os
dois `NOTICE` de bootstrap (`schema "drizzle" already exists`,
`relation "__drizzle_migrations" already exists`) e saiu com status 1 **sem
mostrar o erro que realmente derrubou a migration** (uma linha duplicada de
`pucrs` deixada no banco pelo teste RED). Foi preciso ir ao `psql` conferir a
tabela para descobrir a causa. É upstream do drizzle, não do kata — fica
registrado aqui só porque foi o que custou turnos.

## Why it matters

Reforça o padrão que já apareceu em várias entradas: para tasks de
schema/migração o kata é infraestrutura silenciosa, e o custo de consultar o
`kata-docs` seria puro overhead. O sinal útil é o oposto do de uma task de
rota — vale registrar quando o framework **não** entra em quadro, para que a
triagem não leia "zero lookups" como "docs não ajudaram".

Do lado positivo, vale registrar explicitamente: o `hurl` como rede de
segurança de contrato pegou de graça a pergunta "essa mudança de banco quebra
alguma rota?" — 301 requests contra um servidor de verdade, sem escrever nada
novo. Foi mais barato que raciocinar sobre isso lendo código.

## Metrics

- Consultas ao `kata-docs` MCP: **0** (searches e doc reads). Custo de tokens
  em kata-docs: **0** de um total de ~55k tokens de contexto na implementação.
  Não houve dúvida de framework para pagar por ela — a decisão de não
  consultar não custou nada e não escondeu nada.
- `kata verify --strict-coverage`: 0.81s no pre-commit, 65 arquivos, sem
  achados. Zero falsos positivos.
- `pnpm hurl`: 9.48s, 15 arquivos, 301 requests, 100% verde na primeira
  execução, sem nenhuma edição de `.hurl`.
- Escada completa do pre-commit (format → typecheck → kata-verify → test):
  **125.8s**, dominada pelos testes (105.5s); a fatia do kata é ~0.6% disso.
- Turnos gastos em atrito: ~3 turnos no erro mudo do `drizzle-kit migrate`
  (nenhum deles em kata). Nenhum turno perdido em portão do kata.

## Suggested fix

Nada para o kata. Se algum dia houver apetite por uma regra opcional no
`kata verify` que aponte serviços cujo pressuposto de unicidade não tem índice
correspondente no schema drizzle (exatamente o buraco que #125 fechou à mão),
seria útil — mas é uma ideia especulativa, não uma falha observada, e exigiria
o kata enxergar o schema do drizzle, o que hoje está fora do seu escopo.
