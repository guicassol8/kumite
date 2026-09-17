# Planejar a recuperação de hidratação da sessão foi 100% front — mas o `output`
# do kata apareceu de lado, como fonte de um TS2367 já conhecido

**Found while**: planejamento do #179 (sessão trava em `loading` para sempre
depois de um `GET /me` falho — promise rejeitada cacheada em
`front/src/lib/session.ts:97`).

**Where in kata**: nenhum ponto de contato direto — zero consultas ao
`kata-docs` MCP, zero execuções de `kata verify` ou hurl. O único roçar foi
**de leitura**, em `defineRoute(...).output` (`back/src/modules/users/users.route.ts:29`).

## What

Observação, sem bug. O diagnóstico inteiro saiu de leituras locais:
`front/src/lib/session.ts`, `route-guards.ts`, `routes/__root.tsx`,
`components/header.tsx`, `lib/api.ts` e os catálogos i18n. O mecanismo do bug
(IIFE `async` atribuído a `hydration` sem `catch` → promise rejeitada cacheada
→ `setState` nunca roda → `status` preso em `'loading'`) é legível direto no
arquivo; nada nele depende de saber como o kata funciona.

O detalhe que vale registrar é o **único** ponto do plano em que o kata entrou
em quadro, e ele entrou como armadilha de tipo, não como dúvida de API:
`meRoute` declara `output: PublicUserSchema` — forma curta, sem mapa de status.
O kata então tipa a resposta como literal `200`, e o 401 que sai do middleware
`requireUser` não aparece no tipo. Do lado do front, o plano do #179 precisa
distinguir `401/403` (limpa sessão, vai pro login) de `5xx` (retenta, preserva
o token), e escrever `res.status === 401` no cliente `hc` dá **TS2367**
("comparação sem sobreposição"). A saída acordada foi `const status: number =
res.status` no front, deixando o `output` do back intacto.

Isso é **exatamente** a mesma quina já registrada para o 422 numa task
anterior. A diferença é que agora ela apareceu sem nenhuma consulta ao
`kata-docs`: o conhecimento veio de memória de sessões passadas, não da
documentação. Um agente novo, sem esse histórico, provavelmente escreveria a
comparação, levaria o TS2367 no `pnpm -r typecheck` e gastaria alguns turnos até
ligar o erro ao fato de o status vir do middleware e não do handler.

Também vale anotar que o comentário no topo de `users.route.ts` já explica a
causa ("all of them short-circuit from middleware, which kata lets through
without validating against `output` — ADR-0011"). Ou seja: o projeto documentou
o comportamento **em kumite**, por escrito, três vezes (`users.route.ts`,
`problems.route.ts`, `submissions.route.ts`). A informação existe; ela só não
está onde o compilador ou o `kata-docs` a entregariam no momento do erro.

## Why it matters

É o terceiro registro da mesma fricção sob roupagem diferente (422, 401, agora
com um custo de plano e não só de código). O padrão: **status que o middleware
do kata produz são invisíveis para o consumidor tipado**, e o sintoma chega ao
front como um erro de TypeScript que aponta para o lugar errado — a comparação
no cliente, não a declaração no servidor. Cada vez que reaparece, custa turnos
para alguém sem o contexto.

Não é pedido de mudança de comportamento: a ADR-0011 é uma decisão consciente e
o `output` curto é conveniente. O que falta é o erro se explicar.

## Metrics

- Consultas ao `kata-docs` MCP: **0**. Documentos lidos: **0**. Custo de
  round-trip ao MCP: **0 tokens**. O `kata-docs` teria ajudado? Marginalmente —
  só se uma busca por "middleware status output" devolvesse a ADR-0011; como a
  quina já era conhecida por memória, consultá-lo teria sido overhead.
- Custo total do planejamento: ~16 chamadas de ferramenta, todas locais
  (leituras de arquivo, greps, `python3` para achatar os catálogos i18n) mais
  as chamadas ao `gh`. Duas rodadas de `AskUserQuestion` (4 + 4) e uma de 2 =
  **10 perguntas**, todas de UX/produto (onde renderizar a tela de erro,
  política de retry, timeout, tratamento de 5xx, saída de emergência,
  comportamento do header), **nenhuma** de framework.
- Custo de verificar o ponto do kata: **3 greps + 1 leitura** de
  `users.route.ts` para confirmar que `/me` declara só o 200. Pagou-se, porque
  virou uma linha explícita do plano (T4) em vez de um `typecheck` vermelho
  durante a implementação.
- Atrito de ambiente, não-kata, já visto antes e ainda presente:
  `gh issue view 179 --comments` falhou **duas vezes** com
  `dial tcp ...:443: i/o timeout` e uma vez saiu **vazia com exit 0**. Só
  pegou no 3º retry com `--json`. O `gh issue comment` também precisou de
  retry. Custou ~4 chamadas de ferramenta. A memória do projeto já manda
  envolver `gh` em retry curto; confirmo que continua necessário.

## Suggested fix (optional)

Nada no comportamento. Duas ideias baratas, em ordem de custo:

1. **Docs**: uma entrada no `kata-docs` indexada pelo sintoma, não pela causa —
   algo que uma busca por "TS2367", "status não aparece no tipo do hc" ou
   "comparação sem sobreposição" encontre, explicando que status vindos de
   middleware (401/403/422) não entram no `output` e que a saída no consumidor
   é alargar o tipo (`const status: number = res.status`). Hoje a informação só
   existe na ADR-0011 e em comentários espalhados pelo **kumite**.
2. **Opcional, mais caro**: `defineRoute` poder anotar os status que as
   middlewares da rota podem emitir (derivado do próprio `use: [...]`), de forma
   que o tipo exposto ao `hc` inclua 401/403 sem obrigar o handler a declará-los
   nem a validá-los. Resolveria na raiz, mas é mudança de superfície de tipos —
   registrado como ideia, não como pedido.
