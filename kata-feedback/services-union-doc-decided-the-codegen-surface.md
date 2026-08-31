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
