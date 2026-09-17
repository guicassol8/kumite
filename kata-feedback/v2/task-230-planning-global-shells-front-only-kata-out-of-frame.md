# Planning da #230 (cascas globais: 404, erro, og:image, manifest, lang): kata fora de quadro, MCP ausente de novo

**Found while**: planning-tasks #230 (`defaultNotFoundComponent`/`defaultErrorComponent` do TanStack, metadados Open Graph, `manifest.webmanifest`, `<html lang>` acompanhando o i18n)
**Where in kata**: nenhum módulo tocado; `kata verify` entra no plano só como gate de regressão do `back/`

## What

Task 100% `stack:front`, e das mais distantes do kata que já apareceram nesta
pasta: HTML estático (`front/index.html`), um plugin de `transformIndexHtml` no
`vite.config.ts`, dois componentes React, um gerador Python de SVG em
`docs/design/canvas/generate/make_logo.py`, e um listener de `languageChanged`
do i18next. Zero linhas em `back/`, zero schema, zero migration, zero hurl,
zero rota de API. Nenhuma pergunta de DI, JWT, middleware ou superfície de erro
do kata surgiu — as decisões foram todas de plataforma web (proporção de card
social, `theme_color` único no manifest, substituição de env no HTML) e de
governança da identidade visual.

O `kata-docs` **não estava disponível nesta sessão** — de novo. O `.mcp.json`
declara o servidor; a lista de ferramentas desta sessão não trouxe nenhuma
entrada `kata-docs`, nem como ausente, nem como "requer autenticação". Não
custou nada aqui, porque não havia pergunta de kata a fazer, mas é mais um
ponto na série (ver as entradas de planning das tasks 143, 145, 177, 181 e
216).

## Why it matters

O sinal de superfície continua o mesmo e continua consistente: o epic de
redesign (#214) é quase inteiramente front, e esta issue é o caso extremo —
duas das cinco entregas (`og:image` e `manifest`) nem passam por JavaScript de
aplicação, quanto mais por um framework de API. Para quem triar o kata, o valor
desta entrada é estatístico, não diagnóstico: registra que a proporção de tasks
fora do quadro do kata neste repositório está subindo, e por quê.

O sinal de disponibilidade também não mudou: um MCP de documentação que some em
silêncio só é descoberto quando o agente já formulou a pergunta.

## Metrics

- Consultas à kata-docs MCP: **0** (servidor ausente da sessão; nenhuma
  pergunta de kata surgiu, então a ausência não custou nada).
- Docs do kata lidos: 0. Turnos gastos com kata: 0.
- Onde as respostas realmente vieram: dos `.d.ts` instalados
  (`@tanstack/router-core/dist/esm/route.d.ts`, para confirmar a forma de
  `ErrorComponentProps` e `NotFoundRouteProps` e a existência de
  `defaultErrorComponent`/`defaultNotFoundComponent` no `createRouter`) e do
  próprio repo. Mesmo plano B que as entradas das tasks 143, 174 e 181
  registram — ele continua sendo mais rápido do que uma consulta de docs
  quando o pacote está instalado.

### Fricção da sessão, **não** atribuível ao kata

1. `gh issue view 230 --comments` devolveu **saída vazia com exit code 0**,
   três vezes seguidas, sem nada no stderr. O mesmo `gh issue view 230 --json
   number,title,body,...` funcionou de primeira, no mesmo segundo. Custou 2
   tool calls e um retry em laço até desconfiar do formato, não da rede. Um
   `gh` que devolve vazio e sucesso é pior do que um que dá timeout: o agente
   conclui "issue sem corpo" em vez de "comando falhou". Vale como observação
   de harness para quem usa `gh` em skill.
2. O checkout local de `develop` estava **3 commits atrás** do `origin/develop`,
   e a issue depende de uma PR que mergeou nesse intervalo (#216). Ler o
   `front/index.html` do disco teria produzido um plano que reescreve o favicon
   e o script anti-flash que a #216 acabou de pôr lá. O que salvou foi comparar
   o estado da issue bloqueadora no GitHub (`CLOSED`, `COMPLETED`) com o que o
   disco mostrava e estranhar a divergência. `git fetch` antes de qualquer
   leitura de código é barato; descobrir isso no meio do plano não é.

## Suggested fix (optional)

Nada no kata em si. As duas ideias de harness registradas em entradas
anteriores continuam valendo (falhar alto quando um servidor do `.mcp.json` não
sobe). A nova, específica desta sessão, é de skill e não de kata: a
`planning-tasks` poderia abrir com um `git fetch` explícito antes do Passo 1,
já que ela lê código para planejar e o repo tem `develop` como integração com
várias agentes mergeando em paralelo.
