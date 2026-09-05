# `requireRole` guide example doesn't type-check as written — and `k.resolve` was the lookup that paid for itself

**Found while**: planning #27 (ligar jwtAuth + guard de papel nas rotas de organizador)
**Where in kata**: `kata-docs` MCP — `guide/jwt.md` § "Authorize: guards (403)",
`cookbook/auth.md` § 6, `cookbook/database.md` § 5, `guide/project-layout.md`
§ "Cross-module and process-level test suites"; typings em
`@katajs-framework/core@0.4.2` (`dist/jwt/index.d.ts`, `dist/context-*.d.ts`)

## What

Three findings, one bug and two neutral observations.

**1. (bug, docs) O exemplo canônico de `requireRole` não compila.** Tanto
`guide/jwt.md` § "Authorize: guards (403)" quanto `cookbook/auth.md` § 6
mostram:

```ts
use: [requireUser, requireRole('admin')], // 401 if unauthenticated, 403 if not admin
```

Mas `defineRoute` declara `use?: readonly Middleware<R>[]`, e
`requireRole` devolve `Middleware<R>['handler']` — um handler nu, não um
`Middleware`. O próprio JSDoc de `guard`/`jwtAuth` diz isso explicitamente
("Returns the handler only — the caller wraps it with `defineMiddleware`"),
e o exemplo de `guard` logo abaixo, na mesma página, **envolve**
corretamente com `defineMiddleware({ provides: [] as const, handler: ... })`.
Só o exemplo do `requireRole` (repetido em duas páginas) está no formato
que não type-checa. Também falta ali o argumento de tipo explícito: `R` não
é inferível dos argumentos, então na prática é
`requireRole<AppRegistry>('organizer')`.

**2. (observação) `k.resolve` foi a descoberta que mudou o plano.** A
pergunta real era: uma suíte que dirige `app.request(...)` fala com o
singleton `db` criado dentro de `context.ts` — como fechar aquele pool no
`afterAll` sem que o vitest pendure o worker? Sem docs eu teria ido para
`k.registry.db.__value.$client.end()`, alcançando um campo interno com dois
underscores. `cookbook/database.md` § 5 ("Reset the singleton between
HTTP-level tests") documenta `k.resolve('db')` — acessor público, tipado
por `SingletonKeys<R>`, que devolve exatamente a instância que os handlers
leem. Isso não só resolveu o teardown: eliminou o segundo pool que a suíte
abriria (`createDb()` próprio, como fazem os testes de service hoje).
Nenhuma busca por "guard"/"jwt" levava lá — o caminho foi procurar por
"close singleton db pool teardown test".

**3. (observação) Duas páginas discordam de onde mora uma suíte HTTP.**
`guide/project-layout.md` § "Cross-module and process-level test suites"
manda uma suíte que exercita o app rodando ficar na raiz de `src/`
(`src/e2e.test.ts`, `src/client.test.ts`), com uma justificativa longa e
convincente (o `include` do tsconfig, ADR-0010). Já o exemplo de
`cookbook/database.md` § 5 põe exatamente esse tipo de suíte em
`src/modules/users/users.http.test.ts`. Não é erro de regra — a própria
project-layout explica que `kata verify` descarta `*.test.ts` antes de
despachar regra de nomenclatura, então o caminho do cookbook não é
flagrado — mas as duas páginas recomendam casas diferentes para o mesmo
arquivo, e um agente que só ler o cookbook vai contrariar a orientação
explícita da outra.

## Why it matters

(1) custa uma ida e volta de `tsc` para todo mundo que copiar o exemplo mais
óbvio da página de JWT — que é justamente o caminho feliz do recurso. É a
diferença entre o plano do #27 sair com o wrapper certo e sair com um passo
"ajustar até compilar".

(2) é o oposto: a doc evitou que kumite gravasse acesso a campo interno
(`__value`) no código de teste — exatamente o tipo de coisa que quebra num
upgrade de patch do kata e que ninguém revisa duas vezes.

(3) é barulho pequeno, mas o kumite tem `AGENTS.md` com "mandatory folder
layout" espelhando o do kata: um agente que copiar o caminho do cookbook
cria um arquivo que contraria a doc de layout do próprio kata.

## Metrics

- 5 `search_docs` + 6 `read_doc` (seções, não arquivos inteiros) neste
  planejamento; mais 4 leituras diretas dos `.d.ts` instalados
  (`dist/jwt/index.d.ts`, `dist/context-*.d.ts`) — estas últimas **causadas
  pelo achado 1**: como o exemplo do `requireRole` não batia com o exemplo
  do `guard` na mesma página, tive de ir na assinatura real para decidir
  qual dos dois formatos usar no plano. Custo estimado: ~15k tokens de
  docs + ~12k de typings, contra ~330k do planejamento inteiro.
- Pagou? Sim, com folga, mas de forma desbalanceada: as buscas por
  `requireRole`/`guard` (o assunto da issue) me deram a API e um exemplo
  errado; a busca lateral por teardown de pool (`k.resolve`) foi a que
  realmente mudou uma decisão de design. Se eu tivesse parado nas buscas
  "óbvias" da issue, o plano estaria pior — e eu não saberia.
- Zero perguntas ao usuário foram gastas com coisas que a doc já responde:
  onde a suíte cross-module mora e como fechar o pool saíram de docs, não
  de `AskUserQuestion`.

## Suggested fix (optional)

Para (1): trocar o exemplo em `guide/jwt.md` § "Authorize: guards (403)" e
`cookbook/auth.md` § 6 pelo formato que compila, igual ao do `guard` logo
abaixo:

```ts
const requireAdmin = defineMiddleware({
  provides: [] as const,
  handler: requireRole<AppRegistry>('admin'),
})

use: [requireUser, requireAdmin]
```

Para (3): no exemplo de `cookbook/database.md` § 5, renomear o arquivo para
a raiz de `src/` (ex.: `src/users.http.test.ts`) ou acrescentar uma linha
apontando para `guide/project-layout.md` § "Cross-module and process-level
test suites".
