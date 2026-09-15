# Planning da #181: codegen de blocos — kata-docs MCP ausente de novo; "kata restringe o código de erro?" foi respondido pelo `.d.ts`

**Found while**: planning-tasks #181 (gerador de blocos devolve sucesso para código errado ou fora da allowlist)
**Where in kata**: `@katajs-framework/core` — `ErrorBodySchema` / `c.error(code, …)`; `kata verify --strict-coverage` só como gate

## What

A task vive quase inteira em `@kumite/blocks` (Blockly headless): reservar
`solve`/`input` como reserved words do gerador, sanear terminadores de linha
em comentários de bloco e reprovar bloco desabilitado. O kata só aparece de
raspão, em dois pontos:

1. O plano acrescenta dois códigos de recusa de codegen (`disabled_block`,
   `invalid_generated_code`) que o `submissions.route.ts` devolve via
   `c.error(code, message, { status: 400 })`. A pergunta que precisei
   responder antes de escrever o plano: **o kata mantém algum registro/enum
   de códigos de erro que precise ser declarado na rota?** Se mantivesse, o
   plano teria uma etapa a mais.
2. `kata verify --strict-coverage` como gate das linhas novas em
   `judge.service.ts`.

A resposta do item 1 veio de um `grep` no `dist/*.d.ts` do pacote dentro de
`node_modules` — `error` é string livre no `ErrorBodySchema`, nada a declarar.
Um round-trip, resposta conclusiva. **A kata-docs MCP não estava disponível
nesta sessão**: a lista de MCP servers trouxe Figma, Gmail, ClickUp, Google
Calendar e Google Drive, e nenhum `mcp__kata-docs__*` — nem como servidor
"conectando", nem como servidor pedindo autenticação. Não houve o que
consultar.

## Why it matters

Duas coisas, e a segunda é a que interessa.

A primeira é a continuação de uma série já registrada aqui (tasks #98, #143,
#145): quando a pergunta sobre o kata é factual e estreita, o `.d.ts`
publicado no `node_modules` responde mais rápido e com mais certeza do que
uma busca em prosa responderia — é a API real instalada, não a documentada.
Nas quatro vezes o resultado foi o mesmo, e desta vez nem havia alternativa.

A segunda é sobre a ausência em si. O `CLAUDE.md` do kumite manda "consultar
a kata-docs antes de adivinhar qualquer API do kata". Quando o servidor
simplesmente não está na lista de ferramentas, não há erro, não há aviso —
a instrução vira letra morta em silêncio e o agente segue para o fallback
sem nada registrar. Se a sessão tivesse uma pergunta sobre o kata que o
`.d.ts` *não* respondesse (comportamento de middleware, ordem de validação,
semântica de DI), o modo de falha seria adivinhar sem saber que estava
adivinhando.

## Metrics

- Consultas à kata-docs MCP: **0 — servidor ausente da lista de ferramentas**.
  Docs do kata lidos: 0.
- Superfície do kata investigada: 1 `grep` em
  `node_modules/.pnpm/@katajs-framework+core@0.4.2_*/dist/index.d.ts` +
  `context-*.d.ts`, ~1 turno, custo desprezível perto do total do planning.
  Pagou-se: eliminou uma etapa hipotética do plano.
- Onde o contexto do planning realmente foi: probe do `generateSolution` em
  worktree descartável (2 rodadas de vitest, 3 achados reproduzidos e 3
  correções validadas) e leitura do Blockly 13 em `node_modules`
  (`generator.d.ts`, `block.d.ts`, lista de `RESERVED_WORDS_` no
  `javascript_compressed.js`). Nada disso é superfície do kata.
- Fricção alheia ao kata, registrada porque custou tempo real: a API do
  GitHub ficou inalcançável por vários minutos (`api.github.com` e
  `github.com` com i/o timeout; `raw.githubusercontent.com` e o resto da
  internet de pé), e o `gh` ainda alternou entre timeout e **exit 0 com
  stdout vazio** — falha muda. Custou ~6 turnos de retry antes do
  `gh issue view --json` passar. Nada a ver com o kata; fica aqui porque o
  fluxo das skills depende inteiramente do `gh`.

## Suggested fix (optional)

Nada no kata. Duas observações fora dele:

- Vale o kumite detectar a ausência da kata-docs de forma explícita em vez de
  silenciosa — hoje o agente descobre (ou não) por omissão. Um passo cedo nas
  skills que registre "kata-docs indisponível, usando `.d.ts`/fonte como
  fallback" tornaria essa série mensurável em vez de anedótica.
- O wrapper de retry para `gh` que precisei escrever nesta sessão
  (`for i in 1..N; gh …; sleep`) resolveria o problema de uma vez se morasse
  nas skills, já que os cinco passos do fluxo começam ou terminam em `gh`.
