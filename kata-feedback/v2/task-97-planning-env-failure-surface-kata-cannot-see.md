# Falha de env é invisível pro kata — e o kumite está reimplementando a superfície à mão

**Found while**: planejando #97 (fazer o back falhar com mensagem legível quando
faltar variável de ambiente).

**Where in kata**: nenhuma superfície tocada. O MCP `kata-docs` também não subiu
nesta sessão.

## What

Duas observações, sem bug no kata.

**1. O MCP não estava disponível.** Nenhuma ferramenta `mcp__kata-docs__*`
apareceu na sessão, embora o `.mcp.json` da raiz declare o servidor
(`npx -y @katajs-framework/docs-mcp`). É a quarta vez que isso é registrado
aqui (ver `kata-docs-mcp-connect-timeout-during-planning.md`,
`task-143-...-docs-mcp-down-again-...`, `task-98-...-docs-mcp-down-third-time-...`).
Desta vez custou zero, porque a task não precisava dele — mas o padrão já é
consistente o bastante para valer como sinal: o servidor lançado via `npx -y`
sem versão fixada parece falhar em conectar com frequência não trivial.

**2. A #97 é, na prática, uma superfície de config feita à mão.** O problema
que ela resolve: `back/src/config.ts` faz `EnvSchema.parse(process.env)` no topo
do módulo, e numa worktree nova (sem `.env`) o `ZodError` cru estoura uma vez
por arquivo de teste que importa `config` — na review do PR #92, nove arquivos
de back quebraram com dumps aparentemente desconexos em vez de uma linha
dizendo qual variável falta. O plano aprovado extrai um `parseEnv()` em
`back/src/lib/env.ts` que roda `safeParse`, agrega todas as variáveis
faltantes/inválidas numa mensagem só, aponta o `.env.example` e zera o stack.

Isso é exatamente a lacuna que a entrada da #156 previu ("um dia poderia
justificar uma superfície de config declarada — onde 'var esperada X não está
presente' fosse uma pergunta que o framework consegue responder"). O kumite
agora está escrevendo essa camada localmente, para si próprio, e um segundo
app kata que caia no mesmo buraco escreveria de novo.

Vale notar o que o kata **não** consegue ver aqui: `kata verify` passa com o
`config.ts` atual, porque a falha não está em rota, schema, DI ou middleware —
está num `parse` solto que roda no import. Não é crítica: o kumite optou por
não modelar config via framework, e o kata não tem como saber que aquele
`z.object` é a config do app.

## Why it matters

- O `npx -y` sem pin no `.mcp.json` do kumite é frágil o suficiente para ter
  derrubado o MCP em quatro planejamentos seguidos. Se a causa for resolução de
  versão/rede, fixar a versão (ou documentar o pin recomendado no README do
  docs-mcp) resolveria do lado do consumidor.
- Se o kata quiser um dia oferecer `defineEnv()` / `defineConfig()` — schema zod
  declarado, validado no bootstrap, com erro agregado e legível — o
  `back/src/lib/env.ts` que a #97 vai produzir é um protótipo pronto do
  comportamento desejado, incluindo os detalhes que só aparecem no uso real:
  agregar todas as variáveis em vez de parar na primeira, nunca ecoar o valor
  recebido (`DATABASE_URL`/`JWT_SECRET` são segredos e vazariam no stdout do
  CI), e suprimir o stack porque ele aponta pro próprio arquivo de config.

## Metrics

- Consultas ao `kata-docs` MCP: **0** — servidor não conectado. Docs lidos: **0**.
- Custo do planejamento: ~10 chamadas de ferramenta (`cat`/`grep`/`gh` sobre a
  fonte do kumite) + 2 rodadas de AskUserQuestion (6 perguntas).
- Turnos perdidos por causa do MCP fora do ar: 1 (uma `ToolSearch` para
  confirmar a ausência).
- Custo de não ter consultado o kata-docs: nenhum visível — a task é zod + Node
  puro, sem API do kata no caminho.
- `kata verify` não foi rodado (planejamento não escreve código).

## Suggested fix

Opcional, dois níveis:

1. Barato: pinar a versão do `@katajs-framework/docs-mcp` na config de exemplo
   do MCP, ou investigar por que o `npx -y` falha em conectar tão
   frequentemente.
2. Maior: considerar uma superfície de config declarada no kata, com erro de
   bootstrap agregado. Sem urgência — registro como sinal acumulado, agora com
   dois data points (#156 previu, #97 confirmou).
