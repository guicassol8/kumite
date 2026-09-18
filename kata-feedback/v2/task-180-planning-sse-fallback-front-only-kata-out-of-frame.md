# Planejar o fallback REST do telão foi 100% front: kata nunca entrou em quadro

**Found while**: planejamento do #180 (`/leaderboard` preso em carregando quando
o SSE não conecta, sem cair no fallback REST).

**Where in kata**: nenhum ponto de contato — nem `kata-docs` MCP, nem
`kata verify`, nem hurl, nem DI/JWT/erros.

## What

Observação simples, sem bug. O diagnóstico inteiro saiu de três leituras locais:
`front/src/routes/leaderboard.tsx` (a condição `isLoading` que engole o próprio
fallback que habilita), `front/src/hooks/use-leaderboard-stream.ts` e
`front/src/lib/sse-client.ts`. A única incursão no `back/` foi *de leitura* e
para responder uma pergunta de viabilidade, não de API: `listParticipantRounds`
em `rounds.service.ts` filtra `draft` e devolve `status: 'open'` + `closesAt`, o
que provou que dá pra derivar a rodada ativa sem SSE e sem mudar nada no
servidor. `RoundSummarySchema` foi lido pelo mesmo motivo. Zero consultas ao
`kata-docs`, e nenhuma decisão do plano ficou parecendo chute por isso.

Vale registrar um detalhe que *parece* kata e não é: o canal `/sse` está
deliberadamente fora do cliente RPC tipado (`hc<AppType>`), com o contrato de
wire duplicado à mão em `front/src/lib/sse-schema.ts`. Ou seja, a superfície
mais frágil do front — a que gerou este bug — é exatamente a que o kata não
cobre por decisão de projeto, não por limitação do framework. Não é pedido de
feature; é a anotação de que o custo dessa escolha cai todo no front.

## Why it matters

Reforça o padrão já visto nas entradas #154, #155 e #168: o atrito real numa
task de front nesta base não vem do framework, vem do estado global do e2e. Aqui
especificamente, a evidência exige abrir uma rodada de verdade, então o plano
depende de `withRoundLock`/`roundSlot` (`front/e2e/support/rounds.ts`) — e esses
helpers **existem** hoje, ao contrário do que a entrada de planejamento do #155
registrou na época. Eles entraram depois, e o `grep` de confirmação custou 1
turno. Fica a correção para quem ler as duas entradas em sequência.

## Metrics

- Consultas ao `kata-docs` MCP: **0**. Documentos lidos: **0**. Custo de
  round-trip ao MCP: **0 tokens**.
- Custo total do planejamento: ~14 chamadas de ferramenta, todas locais
  (`gh api`, leituras de arquivo, greps). Três rodadas de `AskUserQuestion`
  (4 + 4 + 3 = 11 perguntas) — todas de produto/UX (profundidade do fallback,
  cópia i18n, limiar de offline, cadência do poll, precedência entre fontes),
  nenhuma de framework.
- O `kata-docs` teria ajudado aqui? Não. Consultá-lo teria sido puro overhead.
- Atrito que valeu registrar, e este é novo: `gh issue view 180 --comments`
  saiu **vazio com exit 0** três vezes seguidas, sem nenhuma mensagem de erro.
  `gh auth status` e `gh issue list` funcionavam normalmente. Só
  `gh api repos/:owner/:repo/issues/180` trouxe o corpo. Custou 4 chamadas de
  ferramenta para descobrir que o problema era o `gh issue view` e não a issue
  ou a autenticação. Nada a ver com kata — é o `gh` em ambiente non-interactive —
  mas é um modo de falha mudo que as cinco skills do workflow pisam no passo 1,
  então vale a nota: preferir `gh api` a `gh issue view` quando a saída vier
  vazia.
