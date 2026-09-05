# Triagem para o repo do kata — 2026-09-01

Brief para uma sessão rodando em `~/Projetos/kata`. Os 18 relatórios desta
pasta foram escritos **do lado consumidor** (kumite), contra o
`@katajs-framework/core` 0.4.2. Este arquivo destila os três que representam
lacuna de capacidade real; o resto é positivo, métrica ou docs gap menor
(listados no fim).

**Antes de abrir qualquer issue**, valide cada afirmação contra o código atual
do kata — os relatórios podem estar defasados, e dois dos três esbarram numa
ADR aceita, ou seja, são revisão de decisão e não adição trivial.

## Onde olhar no kata

| Assunto | Caminho |
|---|---|
| Envelope de erro, `ErrorExtra`, `buildErrorBody` | `packages/kata/src/errors.ts` |
| `c.error` / `c.json` no contexto | `packages/kata/src/context.ts` |
| Tipos do cliente RPC | `packages/kata/src/rpc.ts`, `packages/kata/src/types.ts` |
| Validação de output multi-status | `packages/kata/src/output-validation.ts` |
| Middlewares embutidos (`bodyLimit`) | `packages/kata/src/middlewares/` |
| Guia de erros | `docs/guide/errors.md` |
| Guia de rotas/schemas | `docs/guide/routes-schemas.md` |
| Guia do cliente RPC | `docs/guide/rpc-client.md` |
| Referência de `defineRoute` | `docs/reference/define-route.md` |
| Referência de middlewares | `docs/reference/middleware.md` |
| ADRs relevantes | `docs/adr/0008-unified-error-response-envelope.md`, `docs/adr/0011-multi-status-output-schemas.md`, `docs/adr/0024-raw-output-contracts-and-response-validation.md` |

⚠️ **Toda mudança de doc tem espelho em `docs/pt/`** (30 arquivos, mesma
estrutura: `docs/pt/guide/…`, `docs/pt/reference/…`). Um PR que mexe só em
`docs/guide/errors.md` deixa o mirror fora de sincronia.

Nota de vocabulário levantada pelos relatórios: uma busca no `kata-docs` MCP
com a palavra "ordering" é dominada por ADR-0017 e `guide/app-middleware.md`
(ordenação de **middleware**) e não retorna nada sobre resolução de **path**.
Vale como sinal pra quem mantém o índice lexical.

---

## 1. Erro de domínio não tem onde carregar payload estruturado

**Onde**: `packages/kata/src/errors.ts:53` — `ErrorExtra` é
`{ status?, issues? }`, e o TSDoc logo acima diz **"Closed and typed (ADR-0008,
Alt. C)"**. Ou seja, a ausência é deliberada: isto é um pedido de revisitar a
ADR-0008, não um campo esquecido.

**Repro no consumidor** (kumite, `back/src/modules/problems/`):
`problems.service.ts:149` devolve
`{ ok: false, error: 'incomplete_translations', missingLocales: Locale[] }` —
dado estruturado, tipado. `problems.route.ts:83-90` não tem onde colocá-lo e
interpola numa frase em inglês:
`` `Missing translations for locale(s): ${result.missingLocales.join(', ')}` ``.
Dez linhas abaixo, `reasonMessage()` faz o mesmo com uma união discriminada
(`missing_visible | missing_hidden | missing_both`). Dois erros de domínio
perdendo estrutura no mesmo arquivo.

**Por que dói mais do que parece**: as mensagens do kata são em inglês; um app
com UI multilíngue descarta a prosa por definição e só pode agir sobre o campo
`error`. Quando o código sozinho não basta — *qual* locale falta, *qual* tipo
de caso de teste — a informação não chega, e o cliente reimplementa a regra que
o servidor acabou de avaliar.

`extra.issues` é um quase-acerto: é estruturado e tipado, mas `FieldIssue`
descreve um campo de **input**. Encaixar `missingLocales` ali codifica um fato
de domínio como uma falsa issue de validação.

**Duas saídas, escolher uma**: (a) `extra.details?: JsonValue`, aditivo, sai em
`details` no envelope, `ErrorBodySchema` tipa como opcional/unknown; (b) deixar
o `output` da rota declarar um schema de erro **customizado por status** em vez
de só `ErrorBodySchema` — mais trabalho, mas tipa nas duas pontas e conversa
melhor com a ADR-0011.

**Relatório**: `error-envelope-lacks-structured-domain-issues.md`

## 2. `c.error` não consegue setar header de resposta

**Onde**: mesmo `ErrorExtra` em `packages/kata/src/errors.ts:53`; o wrapping em
`Response` vive em `packages/kata/src/context.ts` (`error(...)` por volta da
linha 611).

**O caso**: os status cuja semântica HTTP **mora num header** ficam de fora —
429/503 (`Retry-After`), 405 (`Allow`), 401 com challenge
(`WWW-Authenticate`). As três saídas de um app hoje são todas piores do que
deveriam: enterrar o número na mensagem legível por humano, cair pra
`c.json(body, 429)` + headers na mão (e aí o app passa a manter o envelope
sozinho, com o `ErrorBodySchema` no `output` ainda typecheckando — drift
silencioso), ou reembrulhar a `Response` a cada call site.

**Repro no consumidor**: prospectivo, não retroativo — kumite ainda não tem
nenhum 429 no código. A rota de submissão (issue #21) prevê cooldown de 5s por
identidade, e o front (#7) só consegue mostrar "aguarde" genérico em vez de um
contador.

**Sugestão**: `headers?: HeadersInit` no `ErrorExtra` — aditivo, sem mudança de
comportamento pra call site existente. Versão mais estreita, se abrir header
arbitrário pelo caminho de erro incomodar: um `retryAfter?: number` documentado
que o kata traduz pro header quando o status é 429/503.

**Relatório**: `c-error-cannot-set-response-headers.md`

## 3. Status não declarado é intipável no cliente RPC

**Onde**: `packages/kata/src/rpc.ts` / `types.ts`; ADR-0011 e ADR-0024 são as
decisões em jogo.

**A tensão, que é estrutural e não um bug**: a ADR-0011 diz — corretamente —
que status vindo de short-circuit de middleware não é validado contra o
`output`, e a ADR-0011 § Alternative C explica por que *declará-lo* é
ativamente errado (o handler nunca roda, não há o que validar). Só que o
cliente RPC tipa exatamente os status declarados: depois de estreitar os
declarados, o `res` restante vira `never`, e ler o corpo do 401/413/422 exige
cast. O autor da rota faz a escolha certa do lado do servidor e paga do lado do
cliente, sem nenhum aviso no ponto da decisão.

Vale o mesmo para o **422 automático** que o próprio kata emite quando o
`input` rejeita: é garantido pelo framework, real em runtime, e não tem
representação no tipo.

**Repro no consumidor**: `front/src/routes/signup.tsx:119` já carrega
`const res = signupRes as unknown as { json: () => Promise<unknown> }` com
cinco linhas de comentário explicando o porquê. E escala: as issues abertas #27
(ligar `jwtAuth` + guards em todas as rotas protegidas) e #7 (consumir 413/429
da submissão) multiplicam esse cast por praticamente toda tela nova.

**Confirmado empiricamente contra 0.4.2** (vale como validação de que a
ADR-0011 entrega o que promete, não só como reclamação): body de 300128 bytes
retorna `413 {"error":"payload_too_large", …}` no envelope padrão; com o mesmo
body e **sem** `Authorization`, ainda retorna 413 e não 401 (`use` roda em
ordem de array, primeiro short-circuit ganha); e `kata verify
--strict-coverage` fica limpo com os dois status ausentes do `output`.

**Sugestão**: nem que seja só um idioma documentado — um tipo exportado tipo
`KataUndeclaredResponse`, ou um parágrafo em `docs/guide/errors.md` ao lado do
callout de perigo já existente, mostrando o escape hatch sancionado. Um
cross-ref da ADR-0011 ("undeclared é ok no servidor") para a consequência no
cliente fecharia o buraco de expectativa.

**Relatórios**: `undeclared-status-client-typing-gap.md`,
`middleware-short-circuits-confirmed-413-beats-401.md`

---

## Docs gaps menores — juntar num PR só de doc

1. **Precedência de path** (`/teams/me` × `/teams/:id`): ganha o mais
   específico ou a ordem de registro em `createApp({ modules })`? Não está na
   doc indexada. Se o comportamento for simplesmente o do Hono, uma frase
   dizendo isso e apontando pra doc do Hono já fecha. Sugerido: seção *Path
   matching and precedence* em `docs/guide/routes-schemas.md`.
   → `route-matching-precedence-docs-gap.md`
2. **422 vs 400 não é descobrível**: a tabela "What's automatic vs. what you
   write" em `docs/guide/errors.md` já tem a informação (diffada contra a tag
   `katajs-v0.3.2`: idêntica), mas nada liga "escrevendo critério de aceite" a
   ela. Um callout — "validação automática de schema é sempre 422; só o seu
   `c.error` produz 400" — evita specs que exigem um status que o framework
   nunca manda. Some com isso: o status do envelope de validação é fixo, e
   `docs/reference/define-route.md` § *Input* não diz que ele **não é
   configurável** nem qual é a saída (validar à mão no handler).
   → `errors-vs-issue-status-mismatch.md`,
   `input-validation-status-is-fixed-at-422.md`
3. **`z.array(...)` como `output`**: funciona, nunca é dito. O recheck no 0.4.2
   confirma que continua não dito — o exemplo novo de
   `docs/guide/routes-schemas.md` usa `output: TodoListSchema` mas nunca
   soletra `TodoListSchema = z.array(TodoSchema)`.
   → `array-output-schema-docs-gap.md`
4. **Ordem de short-circuit do `use:`**: `[bodyLimit, requireAuth]` como exemplo
   trabalhado na material da ADR-0011/`bodyLimit`. É a ordenação relevante pra
   segurança e hoje fica por inferência.
   → `middleware-short-circuits-confirmed-413-beats-401.md`
5. **Cross-link**: `docs/guide/services.md` § *Return results, not responses* é
   citada como a seção que decidiu um desenho de primeira, mas não é linkada de
   `docs/guide/project-layout.md` § "Inside a module" — que é onde alguém chega
   quando está decidindo o que vai no `<domain>.service.ts`.
   → `services-union-doc-decided-the-codegen-surface.md`

## O que **não** virar issue

`204-no-content-doc-paid-off.md`, `jwt-docs-worth-the-tokens.md`,
`rpc-client-docs-informed-frontend-plan.md`, `verify-on-schema-only-module.md`,
`verify-clean-front-only-task.md`, `review-needed-zero-kata-docs-lookups.md`,
`module-lock-caught-a-misreading.md`, `upgrade-0.3.2-to-0.4.2-recheck.md` —
positivos, métricas ou confirmações. Úteis como evidência de uso, não como
trabalho.

Um deles carrega uma observação de instrumentação que vale pra quem for medir o
valor do MCP de docs: atribua a leitura de doc à **task**, não à sessão que fez
a chamada. No kumite, uma leitura no planejamento continuou pagando na
implementação e na review, que registraram zero queries — qualquer medição por
sessão subestima sistematicamente um docs server usado por workflow
multi-sessão.
