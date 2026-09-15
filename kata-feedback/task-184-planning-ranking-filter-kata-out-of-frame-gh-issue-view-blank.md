# Planejamento da #184 não encostou no kata — mas `gh issue view` devolveu vazio com exit 0

**Found while**: planejamento da issue #184 (times que nunca submeteram
aparecem no ranking de `/leaderboard` e no payload do SSE)
**Where in kata**: nada — nenhuma superfície do kata entrou no frame

## What

Entrada de métrica/observação, sem bug do kata.

O bug da #184 vive inteiramente em lógica de domínio do kumite:
`getRoundRanking` monta a lista de times a partir de `fetchTeams` (todo time
ativo) e `reduceBestPerProblem` é explicitamente especificado para dar uma
entrada zerada a quem nunca submeteu. A correção é um `filter` entre
`computeRoundEntries` e `rankTeams`, mais copy de i18n e limpeza de dois
filtros front-side redundantes. Drizzle, React e i18n — zero kata.

**Zero consultas ao servidor MCP `kata-docs`, e nenhuma fez falta.** As duas
superfícies do kata que aparecem no plano entram como restrição passiva:

- `kata verify --strict-coverage` no gate final — a mudança não adiciona rota,
  middleware nem schema novo (`RoundRankingSchema` fica idêntico: muda o
  conteúdo do array, não o contrato), então não há risco previsto.
- `.hurl` continua sendo o E2E de API, e o `ranking.hurl` precisa de uma
  reescrita de asserções porque o arquivo hoje **narra o bug como se fosse a
  regra** ("Time C nunca submete — deve aparecer, zerado"). Vale notar como
  observação genérica sobre testes de contrato: um E2E declarativo fixa o
  comportamento observado tão bem quanto o desejado, e não tem como distinguir
  os dois.

## Why it matters

Mais um ponto na série `task-*-planning-*-kata-out-of-frame.md`: em tasks de
domínio puro o kata é invisível, que é o comportamento desejado num framework
opinativo de layout.

O custo real desta sessão **não** foi kata, foi o `gh` — registrado abaixo só
para não atribuir a fricção ao framework.

## Metrics

- Consultas ao `kata-docs` MCP: **0**. Docs lidos: **0**. Custo de tokens em
  round-trip de kata-docs: **0**.
- Contexto gasto quase todo em leitura de fonte do kumite
  (`ranking.service.ts`, `ranking.hurl`, `ranking.test.ts`, `sse.service.ts`,
  `leaderboard.tsx`, `index.tsx`, `organizer.index.tsx`, catálogos de i18n).
- **Fricção de ferramenta, não-kata**: `gh issue view 184 --comments` devolveu
  **saída vazia com exit 0** — não um erro, não um timeout, simplesmente nada.
  Redirecionar para arquivo confirmou 0 bytes. `gh auth status` estava são.
  Custou 4 chamadas até a troca para `gh api repos/:owner/:repo/issues/184
  --jq '.body'`, que funcionou de primeira e seguiu funcionando o resto da
  sessão (inclusive para `gh issue comment`, que **não** foi afetado).
  Um exit 0 mudo é pior que um erro: gastou turnos verificando autenticação e
  rede antes de suspeitar do subcomando. O caminho REST via `gh api` é o
  fallback confiável — é a segunda vez que esta pasta registra o padrão
  (ver `task-176-planning-drizzle-and-domain-only-zero-docs-lookups.md`, onde
  o GraphQL do `gh` também falhou e o REST salvou).
- `pnpm verify` / `kata verify` não foram executados nesta sessão: o
  planejamento não escreve código, e a exploração foi toda leitura no checkout
  principal, sem worktree.

## Suggested fix

Nenhum para o kata. Entrada de observação e métrica.
