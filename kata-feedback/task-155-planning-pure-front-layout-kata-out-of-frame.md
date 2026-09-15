# Planejar um bug de layout puro no front nunca cruzou com o kata

**Found while**: planejamento do #155 (ancorar a barra de ações e a faixa de
resultados dentro da viewport em `/problem/$id`).

**Where in kata**: nenhum ponto de contato — nem `kata-docs` MCP, nem
`kata verify`, nem hurl, nem DI/JWT/erros.

## What

Observação simples, sem bug. O plano inteiro saiu de CSS (flexbox: `min-h-dvh`
no root, `flex-basis: 0` + `min-h-0` no `main`, `overflow: visible` deixando os
filhos escaparem) e da leitura de `front/src/routes/problem.$id.tsx`,
`__root.tsx`, dos dois componentes de resultado e do `ResizeObserver` já
existente em `blockly-workspace.tsx`. Zero consultas ao `kata-docs`, e nenhuma
decisão do plano ficou parecendo chute por causa disso.

O back só apareceu de raspão, e ainda assim como *ambiente de teste*, não como
API: os estados de rodada aberta na spec de evidência precisam de uma rodada
real aberta, e o slot único de rodada aberta (#150) continua sendo o fator de
custo dominante do e2e desta task — o que motivou a decisão de cobrir o
banner 429 com `page.route()` em vez de duas submissões reais.

## Why it matters

Serve de contraponto às entradas de planejamento fullstack: reforça que o
gatilho de "atempt a report" produz sinal útil mesmo quando a resposta é
"kata não estava em quadro". Também registra que o atrito real de uma task de
front nesta base não vem do framework, vem da contenção de estado global no
e2e (rodada aberta única, banco compartilhado) — que é kumite, não kata, e já
tem issue própria fechada.

## Metrics

- Consultas ao `kata-docs` MCP: **0**. Documentos lidos: **0**. Custo de
  round-trip ao MCP: **0 tokens**.
- Custo total do planejamento: ~15 chamadas de ferramenta, todas locais
  (`gh issue view`, leituras de arquivo, `git show`, greps). Duas rodadas de
  `AskUserQuestion` (4 + 3 perguntas) e uma terceira de 2 — as decisões que
  sobraram eram de produto/UX, não de framework.
- O `kata-docs` teria ajudado aqui? Não. Consultá-lo teria sido puro overhead.
- Atrito que valeu registrar: uma memória de sessão anterior citava um helper
  `withRoundLock`/`roundSlot` como fruto do #150; `grep` no `develop` não achou
  nada disso. A issue fechou por outro caminho e o padrão vigente continua sendo
  o `openWithRetry` do `editor-fixture` mais o "feche o que estiver aberto" do
  `footer.spec.ts`. Verificar antes de planejar em cima disso custou 2 turnos e
  evitou um plano apoiado num helper inexistente.
