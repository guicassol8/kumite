# `guide/services.md` decidiu a superfície de erro antes de eu inventar uma

**Found while**: planning-tasks da issue #20 (codegen server-side: workspace
JSON → JS via Blockly headless, módulo `judge` do back)
**Where in kata**: `guide/services.md` (§ *Return results, not responses*),
`guide/project-layout.md` (sufixos travados de módulo)

## What

A #20 precisava de uma decisão que o repo kumite ainda não tinha precedente
forte: como um serviço reporta uma falha de domínio que a rota vai virar 400.
As três saídas plausíveis eram lançar um erro próprio, deixar o `BlocksError`
do `@kumite/blocks` vazar até a camada HTTP, ou devolver uma união
discriminada.

Um `search_docs` por "service throwing errors vs returning result c.error
handler mapping" trouxe `guide/services.md` § *Return results, not responses*
no topo, e o `read_doc` daquela seção resolve a questão sem ambiguidade —
inclusive com o exemplo `CheckoutResult` mostrando o formato exato
(`{ ok: false, error: 'product_unavailable', productId }`) e a observação de
que a própria função de mapeamento erro→status fica no serviço, pura e
testável. O plano foi escrito em cima disso literalmente, incluindo a regra
"reserve throwing for genuine bugs" pra decidir que um erro não-`BlocksError`
propaga em vez de virar uma variante da união.

Um segundo `search_docs` ("module layout verify rules file naming extra files
in module folder") reconfirmou os sufixos travados de pasta de módulo, o que
descartou de saída a opção de um `codegen.ts` avulso dentro de
`src/modules/judge/`. Essa parte eu já sabia — está registrada em
`module-lock-caught-a-misreading.md` (planejamento da #19) e em
`verify-on-schema-only-module.md` — então aqui o docs só confirmou memória,
não produziu informação nova.

## Why it matters

Não é bug nem lacuna: é o caso em que a doc do kata está no lugar certo e
responde a pergunta de design na primeira tentativa. Vale registrar porque a
maior parte das entradas desta pasta é sobre atrito; esta é o contraponto —
o `guide/` sendo usado como fonte de decisão arquitetural num plano, não
como referência de API. O sinal útil pra quem mantém o kata: a seção
*Return results, not responses* é curta, tem exemplo completo e ranqueou
primeiro numa query em linguagem natural que não citava nenhum nome de API.

## Metrics

- 2 `search_docs` + 1 `read_doc` (só a seção, via `heading` — evitou puxar o
  `guide/services.md` inteiro) neste turno de planejamento.
- Custo pequeno perto do total: a maior parte do turno foi ler o código já
  existente (`@kumite/blocks`, `judge.service.ts`/`judge.test.ts` vindos da
  #19, `submissions.schema.ts` da #18) e interrogar o usuário nas duas
  rodadas de `AskUserQuestion` — 8 decisões fechadas, nenhuma delas
  respondível pela doc do kata.
- Payoff claro no 1º lookup: virou a pergunta "qual das 3 formas?" numa
  recomendação com respaldo, e a opção recomendada foi a escolhida.
- Payoff nulo no 2º: puro re-check de uma regra já registrada duas vezes
  nesta pasta. Barato, mas dá pra pular numa próxima — o padrão que emerge é
  que a regra de layout do kata só precisa ser consultada uma vez por
  agente/sessão, não uma vez por task.

## Suggested fix (optional)

Nenhum. Se houver interesse em fortalecer o que já funciona: a seção
*Return results, not responses* não é linkada a partir de
`guide/project-layout.md` § "Inside a module", que é onde alguém chega quando
está decidindo o que vai dentro de `<domain>.service.ts`. Um link cruzado ali
economizaria a busca.

## Update — fase de implementação (#20, 2026-08-31)

**Lookups no kata-docs durante a codificação: zero.** O plano já carregava a
decisão de superfície (união discriminada, erro não-`BlocksError` propaga), e
nada no loop RED→GREEN levantou uma pergunta nova sobre o kata. Confirma a
leitura do parágrafo de métricas acima: quando a doc é consultada na hora
certa (planejamento), a implementação não precisa voltar lá.

**`kata verify`**: 8 execuções (4 pelo hook de pre-commit, as demais na
escada de gates), ~0,6 s cada, sempre `no problems found (37 files checked)`.
O módulo `judge` seguiu sem `.route.ts`/`.hurl` e o `--strict-coverage` não
reclamou — mais um ponto pro registro de `verify-on-schema-only-module.md`:
módulo sem rota não é falso-positivo pro verify.

**O que pegou algo real foi o typecheck, não o kata.** O pre-commit barrou o
commit do T2 com `WorkspaceState` (`Record<string, unknown>`, do
`@kumite/blocks`) não sendo atribuível ao `Workspace`
(`Record<string, JsonValue>`, do zod) — a direção contrária à que o plano
tinha checado. Custo: um commit abortado e uma correção de duas linhas (o
teste passa o fixture pelo `WorkspaceSchema`, que é o mesmo passo que a rota
vai dar no body). Atrito saudável: o hook rodou a escada inteira e falhou
antes de sujar o histórico. Vale anotar que a escada completa roda ~40 s por
commit, o que é o custo dominante do loop — 5 commits ≈ 3,5 min só de gates.

**Smoke fora do vitest (T5)**: o aviso do `blocks/AGENTS.md` sobre
`blockly/core` resolver pra CJS em silêncio sob a condição `node` **não se
materializou** — `tsx` carregou o serviço e o `generateJudgeSource` devolveu
o `solve(input)` esperado, além da recusa `missing_root` localizada. Nada a
reportar pro kata aqui; fica o registro de que o caminho headless está bom
pro boot do app na #21.

**Custo total do turno de implementação**: nenhum token gasto em MCP do kata.
O grosso foi ler o código existente (`@kumite/blocks`, o `judge` da #19) e
esperar a escada de gates.

## Review-side confirmation (PR #90)

Gate ladder rerun from a clean detached checkout of `task/20-judge-codegen`
com Postgres próprio (container `kumite-review90-db`, porta 5436) e
`back/.env` do worktree:

- `pnpm -r typecheck` — 3/3 pacotes verdes.
- `pnpm verify` — `kata verify --strict-coverage`: **"no problems found
  (37 files checked)"**, ~0,6 s. Terceira confirmação independente de que
  módulo sem `.route.ts`/`.hurl` não é falso-positivo pro `--strict-coverage`
  (as outras em `verify-on-schema-only-module.md` e no Update acima).
- `pnpm -r test` — blocks 40 / back 128 / front 134, tudo verde.
- `pnpm --filter @kumite/back hurl` — 54 requests, 6/6 arquivos. A #20 não
  abre rota, mas rodar o suite completo prova que importar Blockly headless
  no `judge.service.ts` não quebra o boot do app sob `tsx` — que é
  exatamente o risco que o T5 do plano queria cobrir e o que a #21 vai
  exercitar de verdade.
- `pnpm format` — "No fixes applied", sem drift.

**Zero lookups no `kata-docs` durante o review.** A superfície kata do diff
é um serviço puro devolvendo união discriminada — o padrão que a própria
`guide/services.md` prescreve — então não havia pergunta a fazer. Isso fecha
o ciclo desta entrada: 3 lookups no planejamento, 0 na implementação, 0 no
review. O custo de doc concentrou-se inteiramente na fase em que a decisão
foi tomada, que é o comportamento desejável.

**Mutation checks (o que o review acrescentou de fato).** Duas mutações
manuais, ambas revertidas:

1. `expected: 6` → `7` no teste de paridade → vermelho
   (`['failed','passed','passed']`). O teste de contrato editor ↔ juiz não
   é vacuoso, como o corpo do PR afirma.
2. Trocar `if (!(cause instanceof BlocksError)) throw cause` por um cast
   (`const err = cause as BlocksError`) → **os 21 testes continuam verdes.**
   A guarda que separa "bug genuíno → 500" de "recusa de domínio → 400" é
   a única linha do diff sem cobertura. Não bloqueia a #20 (o código está
   correto e o `kata verify` não tem como ver isso), mas é o teste que a
   #21 deve trazer junto com a rota, onde a diferença vira status HTTP.

**Fricção não-kata, pra registro.** `pnpm exec tsx -e "<imports estáticos>"`
falha com `ERR_PACKAGE_PATH_NOT_EXPORTED` em `@kumite/blocks`: o `-e` do tsx
resolve pelo loader CJS, e o `exports` do pacote só declara a condição
`import`. O smoke do T5 escapou disso por usar `import()` dinâmico dentro do
`-e`. Reproduzir o smoke como arquivo `.ts` de verdade funciona e é o mais
próximo do boot real — foi assim que confirmei o `solve(input)` gerado
(`var soma, numero;` acima da função) e a recusa `missing_root` em espanhol.
Nada pro kata; anotado porque o próximo agente que tentar o smoke via `-e`
vai bater na mesma pedra.
