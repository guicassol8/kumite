# Planejamento da #226: task sem código (só corpos de issue) — kata fora de quadro, zero consultas

**Found while**: planning-tasks #226 (sanear os corpos das issues do epic #214)
**Where in kata**: nenhum módulo tocado; nenhum comando do kata executado

## What

A #226 não edita arquivo nenhum do repo — o trabalho todo é `gh issue edit` em
12 issues e `gh issue create` em 2. O planejamento leu `back/src/modules/**`
(`rounds.schema.ts`, `sse.schema.ts`, `problems.schema.ts`) apenas para
**verificar afirmações da auditoria** sobre o payload que o front recebe:
que `position` existe em `RoundDetail`/`ParticipantRoundDetail` mas não no
payload de `/problems/:id`, e que `RoundRefSchema` do SSE é só
`{id, closesAt}`. Tudo respondido lendo o zod direto em ~2 greps; nada que
precisasse da kata-docs.

## Why it matters

Terceiro registro seguido de "kata fora de quadro" em tasks do epic de design
(#215 review, #226 planning). O padrão agora é claro o suficiente para nomear:
**o contrato de dados do kumite é legível nos schemas zod, não na superfície do
kata** — quando a pergunta é "esse campo chega na tela?", a resposta está em
`<domain>.schema.ts` e o custo é um grep. A kata-docs só entraria em quadro se
a pergunta fosse sobre *como* o kata monta/valida a resposta (DI, middleware,
formato do 422), não sobre *o que* o schema declara.

Ponto secundário, do harness e não do kata: o Stop hook agora roda a gate
ladder só com mudança de código pendente (commit `551b443`), o que fez esta
sessão — que não toca arquivo do repo — não pagar nada de Postgres/vitest.
É exatamente a observação que ficou pendurada no feedback da #215.

## Metrics

- Consultas à kata-docs MCP: 0. Docs do kata lidos: 0.
- Comandos do kata executados: 0 (`kata verify` não rodou — nenhum diff em `back/`).
- Verificação de contrato: 2 greps em `back/src/modules/**` responderam 3
  afirmações da auditoria (position no problema, position na rodada, nome da
  rodada no SSE). Custo estimado: < 2k tokens; teria sido mais caro perguntar.
- Fricção: nenhuma atribuível ao kata.

## Suggested fix (optional)

Nenhum. Registro de sinal: para tasks de contrato front↔back, o caminho barato
é ler o zod do módulo; vale medir se a kata-docs alguma vez ganha dessa rota
antes de investir nela em planejamentos futuros.
