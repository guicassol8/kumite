# Planning da #229 (tela da rodada na nova identidade): kata fora de quadro, MCP não consultado

**Found while**: planning-tasks #229 (`/rounds/$id` na identidade v1 — cabeçalho, contagem regressiva, problemas com letra A/B/C)
**Where in kata**: nenhum módulo tocado; `kata verify` entra no plano só como degrau da gate ladder

## What

Mais uma task `stack:front` pura. O plano tem 10 passos e **nenhum** encosta em
`back/`: gerador de pranchas em Python (`docs/design/canvas/generate/`), duas
variantes de cva nos primitivos do shadcn, uma prop e dois atributos de a11y
num componente React compartilhado, um grid CSS no lugar de `<table>`, seis
chaves i18n nos três catálogos e uma spec do Playwright.

O detalhe que vale registrar é **por que** o back ficou fora: a pergunta de
dados mais importante do planejamento — "a API devolve a posição do problema
dentro da rodada, para renderizar a letra A/B/C?" — foi respondida em uma
leitura de `back/src/modules/rounds/rounds.schema.ts`, onde
`ParticipantRoundProblemSchema` já declara `position: z.number().int().nonnegative()`.
O schema zod do kumite, lido direto, é documentação suficiente do contrato; não
houve momento nenhum em que uma pergunta sobre o kata (DI, middleware, formato
de erro, regras do `verify`, hurl) tivesse cabido. **A kata-docs MCP não foi
consultada — não por estar ausente, mas por não haver o que perguntar.**

## Why it matters

1. **Superfície**: mais um ponto na série "task fora do quadro do kata", e o
   epic #214 vai continuar produzindo esses pontos — das suas sub-issues
   abertas (#217–#223, #229, #230, #233, #234), só a #231 (e-mail de
   redefinição) chega perto de uma superfície do kata. Para quem triar esta
   pasta: a densidade de feedback útil sobre o kata caiu porque a *natureza do
   trabalho* mudou, não porque o kata melhorou ou piorou. Vale não ler a série
   de `out-of-frame` como sinal de qualidade.
2. **Um elogio implícito ao formato**: a única pergunta de contrato do
   planejamento foi respondida pelo zod, sem round-trip. Um framework cujo
   schema de entrada/saída é o mesmo objeto que documenta o DTO tira a
   necessidade de doc externa nesse eixo — é o oposto do custo registrado nas
   entradas das tasks 143, 174 e 181, onde a resposta só veio dos `.d.ts` do
   pacote depois que a MCP falhou.

## Metrics

- Consultas à kata-docs MCP: **0**. Docs do kata lidos: 0. Turnos gastos com
  kata: 0. Tokens gastos em kata: 0 de ~90k da sessão de planejamento.
- Custo de responder a única pergunta de contrato: **1 tool call**
  (`grep` + leitura de 60 linhas de `rounds.schema.ts`). Não houve plano B
  porque não houve plano A falho.
- Fricção real da sessão, **não** atribuível ao kata, duas ocorrências:
  - `gh issue view 229 --comments` devolveu **saída vazia com exit 0**, duas
    vezes seguidas (inclusive com retry e redirecionamento para arquivo). O
    mesmo dado veio inteiro com `--json`. Falha silenciosa, não timeout — a
    entrada da #216 registra a variante com `i/o timeout`; esta é pior, porque
    um exit 0 mudo passa por "a issue não tem comentários". Custo: 2 tool calls.
  - O checkout principal estava **3 commits atrás** de `origin/develop`, e os
    três eram exatamente as issues das quais a #229 depende (#216 fundação de
    tokens, #228 breakpoint, #227 logo). Ler `front/src/index.css` local levou a
    uma conclusão errada e já registrada por escrito ("a #216 está fechada mas
    os tokens não existem") que só caiu ao consultar a lista de PRs. Custo: ~4
    tool calls. Nada a ver com o kata; vale como lembrete de que
    `planning-tasks` deveria começar por um `git fetch`.

## Suggested fix (optional)

Nada no kata. Uma observação para quem mantém o kumite, não o kata: o passo 1
do skill `planning-tasks` manda absorver a issue e explorar o código, mas não
manda sincronizar o checkout — e num repo onde as issues do mesmo epic mergeiam
em sequência, planejar contra uma árvore atrasada é planejar contra um mundo
que não existe mais.
