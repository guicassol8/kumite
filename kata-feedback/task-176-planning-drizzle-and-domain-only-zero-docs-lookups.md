# Planejamento da #176 não encostou no kata — zero consultas ao kata-docs

**Found while**: planejamento da issue #176 (submissão aceita no último
segundo da rodada é descartada dos rankings)
**Where in kata**: nada — nenhuma superfície do kata entrou no frame

## What

Entrada de métrica/observação, sem bug.

O bug da #176 vive inteiramente em código de domínio do kumite: a rodada de
uma submissão é *derivada por janela de tempo* sobre `submissions.created_at`,
que o Postgres carimba no INSERT (pós-julgamento) e não no aceite. O plano
inteiro — coluna `round_id`, migration de backfill, escopo das leituras de
melhor pontuação, e segurar o evento `round.closed` no SSE até drenar o
julgamento em voo — é drizzle + lógica de serviço.

**Zero consultas ao servidor MCP `kata-docs` foram feitas, e nenhuma fez
falta.** O que o planejamento precisou saber estava tudo em código lido
direto: `defineRoute`/`c.error`/`output` já aparecem por exemplo nos módulos
vizinhos, e as regras de layout obrigatórias estão em `back/AGENTS.md`, não
nos docs do kata.

Duas superfícies do kata aparecem no plano, mas só como restrição passiva,
sem precisar de consulta:

- `kata verify --strict-coverage` roda no gate final (T10) — a mudança não
  adiciona rota nova nem middleware, então não há risco previsto de o
  `--strict-coverage` reclamar.
- `.hurl` continua sendo o E2E de API. O plano registra explicitamente que a
  corrida "judge lento × fechamento de rodada" **não é expressável em hurl**
  (não há como atrasar o julgamento de dentro do arquivo), então essa borda
  fica coberta por vitest com `vi.mock` e o hurl cobre só o escopo por
  rodada. Isso não é reclamação: é a mesma limitação de "hurl não tem
  teardown/controle de tempo" já registrada em entradas anteriores desta
  pasta, reaparecendo num contexto novo.

## Why it matters

Sinal de calibragem, na direção positiva: numa task P1 de banco + lógica de
ranking, o kata ficou fora do caminho por completo — nenhuma abstração do
framework precisou ser entendida para desenhar a correção. Para um framework
opinativo de layout, "invisível quando não é relevante" é o comportamento
desejado.

O padrão vale a leitura em conjunto com as outras entradas
`task-*-planning-*-kata-out-of-frame.md` desta pasta: a fatia de tasks do
kumite em que o kata-docs é consultado é pequena, e as consultas se
concentram em superfícies de borda (erros customizados, DI, guards), não no
dia a dia de domínio.

## Metrics

- Consultas ao `kata-docs` MCP: **0**. Docs lidos: **0**. Custo de tokens em
  round-trip de kata-docs: **0**.
- Contexto do planejamento gasto quase todo em leitura de fonte do kumite
  (`ranking.service.ts`, `submissions.service.ts`, `rounds.service.ts`,
  `sse.service.ts`, `db/schema.ts`, `leaderboard.tsx`) e nas migrations
  existentes.
- Custo real desta sessão **não** foi kata: a rede da máquina caiu no início
  e a API do GitHub (`api.github.com`) ficou inalcançável, custando ~8
  tentativas e vários minutos só para conseguir ler o corpo da issue. O
  endpoint GraphQL seguiu instável até o fim — `gh issue view --comments` e
  `gh issue comment` falharam com timeout, e o caminho REST (`gh api
  repos/:owner/:repo/issues/N/comments`) foi o que funcionou. Sem relação com
  kata, registrado só para não atribuir a lentidão da sessão ao framework.
- Precedente útil achado em migrations, não em docs: `drizzle-kit generate
  --custom` (`back/drizzle/0005_round_problems_published_only.sql`) é o jeito
  sancionado de escrever SQL à mão sem violar a proibição de editar arquivos
  gerados em `back/drizzle/`.

## Suggested fix

Nenhum. Entrada de observação e métrica.
