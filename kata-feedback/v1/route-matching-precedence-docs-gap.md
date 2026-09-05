# Precedência de rotas (segmento estático × `:param`) não está na doc indexada

**Found while**: planning-tasks da issue #33 (telas de times no front — que
acabou exigindo estender o `GET /teams` do módulo `teams` no back)
**Where in kata**: `mcp__kata-docs__search_docs` / `guide/routes-schemas.md`,
registro de rotas (`createApp({ modules })`)

## What

Uma das opções de desenho em cima da mesa era criar um `GET /teams/me` ao lado
do `POST /teams/:id/join` que já existe. Antes de recomendar essa opção eu quis
confirmar como o kata resolve um segmento estático (`/teams/me`) competindo com
um parâmetro (`/teams/:id`) no mesmo nível: ganha o mais específico, ou ganha a
ordem de registro dos módulos/rotas? A pergunta é decisiva na prática — se for
por ordem de registro, um `GET /teams/:id` acrescentado depois por outra task
sequestra silenciosamente o `/teams/me`.

`search_docs("route path parameter collision static segment ordering")`
devolveu cinco hits, nenhum sobre isso: `guide/routes-schemas.md` § *`input` —
the four sections* (o topo, sobre schemas de `params`, não sobre matching),
`adr/0017-middleware-ordering.md` e `guide/app-middleware.md` § *Ordering* (que
falam de ordem de **middleware**, não de rota), `guide/rpc-client.md` §
*Calling routes* e o cookbook do NestJS. O termo "ordering" puxou tudo que é
ordenação de middleware e nada de resolução de path.

Resolvi por outro caminho: o `teams.route.ts` atual não tem nenhum `GET
/teams/:id`, então a colisão não existe hoje de qualquer jeito — e a opção
escolhida pelo usuário acabou sendo enriquecer o `GET /teams` existente com um
envelope, sem rota nova. A pergunta ficou sem resposta, mas deixou de importar
para esta task.

No mesmo turno precisei do formato exato do `ErrorBody` (o front vai mapear
`error` → chave i18n campo a campo). Aí nem tentei o kata-docs: fui direto ao
`back/node_modules/@katajs-framework/core/dist/context-*.d.ts`, que traz
`{ error, message, issues? }` documentado em TSDoc com referência à ADR-0008.
Um lookup que a doc provavelmente responderia, mas o `.d.ts` estava a um grep
de distância e não custa round-trip de MCP.

Vale registrar também que o plano troca o `output` do `listTeamsRoute` de
`z.array(TeamSummarySchema)` para um objeto envelope — o caminho inverso do que
está em `array-output-schema-docs-gap.md`. Nenhuma dúvida surgiu dessa vez: a
regra `kata/inline-schema` já é conhecida (o envelope nasce como
`TeamsListSchema` nomeado em `teams.schema.ts`) e o efeito no front é só
`pnpm -r typecheck` reclamando nos consumidores, que aqui ainda não existem.

## Why it matters

Ordem de resolução de rota é uma daquelas coisas que só machucam meses depois,
quando alguém adiciona a rota que colide — exatamente o cenário de um repo como
o kumite, onde cada módulo cresce em tasks separadas e por agentes diferentes.
Como a doc indexada não fixa a regra, cada agente vai resolver por tentativa e
erro (ou por leitura do fonte do kata), e o que ele decidir não fica escrito em
lugar nenhum. É uma lacuna barata de fechar: uma frase em
`guide/routes-schemas.md` já resolveria.

Sinal secundário para quem mantém o índice: a query em linguagem natural com a
palavra "ordering" foi dominada por documentos de ordenação de middleware. As
duas coisas competem pelo mesmo vocabulário.

## Metrics

- 1 `search_docs`, 0 `read_doc` neste turno de planejamento — o lookup mais
  barato até agora nesta pasta, e sem payoff: nenhum dos cinco hits tocava a
  pergunta.
- Custo desprezível perto do total do turno, que foi quase inteiro leitura de
  código kumite (`teams.{route,service,schema,hurl}.ts`, `db/schema.ts`,
  `front/src/lib/{api,session,route-guards}.ts`, telas e testes existentes) e
  duas rodadas de `AskUserQuestion` — 8 decisões fechadas, nenhuma delas
  respondível pela doc do kata.
- O achado que definiu o plano não veio do kata nem da doc: veio de cruzar o
  `output` do `listTeamsRoute` com os critérios de aceite da issue e perceber
  que 3 dos 4 eram impossíveis com a API existente. Nenhuma ferramenta ajuda
  nisso além de ler os dois lados.
- `ErrorBody` via `.d.ts` em vez de kata-docs: 1 grep + 1 `sed`, ~90 linhas
  lidas, resposta completa com a ADR referenciada. Para formato de tipo, o
  `.d.ts` empacotado continua sendo mais barato que um round-trip de MCP.

## Suggested fix (optional)

Uma seção curta em `guide/routes-schemas.md` — algo como *Path matching and
precedence* — dizendo se `/teams/me` vence `/teams/:id` por especificidade ou
se depende da ordem em `createApp({ modules })`, e (se for ordem) qual a
recomendação de declaração. Se o comportamento for simplesmente o do Hono
subjacente, uma frase dizendo isso e apontando para a doc do Hono já fecha a
lacuna.
