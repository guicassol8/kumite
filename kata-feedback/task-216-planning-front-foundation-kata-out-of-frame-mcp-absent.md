# Planning da #216 (fundação da identidade no front): kata fora de quadro e MCP ausente da sessão

**Found while**: planning-tasks #216 (tokens claro/escuro, fontes Barlow no bundle, tema, favicon)
**Where in kata**: nenhum módulo tocado; `kata verify` aparece no plano só como gate de regressão

## What

Task 100% `stack:front`: `front/src/index.css`, `@fontsource/*`, um módulo de
tema com `localStorage`, componentes de marca em SVG e a variante `destructive`
do botão do shadcn. Zero linhas em `back/`, zero schema, zero migration, zero
hurl. Nenhuma pergunta de API, DI, JWT ou erro do kata apareceu no
planejamento — as decisões todas foram de Tailwind v4 (`@theme` vs `:root` na
escala de raio), de governança de design tokens e de anti-drift entre
`docs/design/` e o `front/`.

Observação mais interessante que "não toquei no kata": **o servidor `kata-docs`
não estava disponível nesta sessão**. O `.mcp.json` o declara, mas a lista de
servidores MCP do harness nesta sessão trouxe apenas os conectores do
claude.ai (ClickUp, Figma, Gmail, Drive, Calendar) — `kata-docs` não apareceu
nem como "conectando", nem como "requer autenticação". Não bloqueou nada aqui,
porque não havia pergunta de kata a fazer, mas é a sexta sessão registrada
nesta pasta em que o servidor está ausente sem aviso (ver as entradas de
planning das tasks 143, 145, 177 e 181). O padrão é: quando a task precisa
dele, a ausência só é descoberta no momento da consulta.

## Why it matters

Dois sinais distintos, que vale não misturar:

1. **Superfície**: mais um ponto na série "task fora do quadro do kata". Das
   124 entradas desta pasta, 21 já trazem `out-of-frame` no nome. O epic de
   redesign (#214) tem 11 sub-issues de tela e só uma `stack:back` (#231), então
   essa proporção vai piorar antes de melhorar — o que é informação útil para
   quem decide quanto investir em superfície do kata voltada a este repositório.
2. **Disponibilidade**: um MCP de documentação que some em silêncio é pior do
   que um que erra, porque o agente só descobre quando já formulou a pergunta.
   Numa task que precisasse dele, o custo seria turnos gastos antes de cair no
   plano B (ler os `.d.ts` do pacote instalado, que é o que as entradas das
   tasks 143, 174 e 181 registram ter funcionado).

## Metrics

- Consultas à kata-docs MCP: **0** (servidor ausente da sessão; nenhuma
  pergunta de kata surgiu, então a ausência não custou nada).
- Docs do kata lidos: 0. Turnos gastos com kata: 0.
- Fricção real da sessão, **não** atribuível ao kata: `api.github.com`
  resolvendo para `4.228.31.149` e dando `i/o timeout` em ~8 de 10 tentativas.
  Custou ~10 minutos e 5 tool calls só para ler o corpo da issue; a primeira
  chamada `gh` da sessão passou e as seguintes não, então o retry em background
  foi o que destravou. Padrão já registrado na memória do projeto
  (`kumite-github-ssh-timeout-use-gh-token-https`), agora valendo também para
  a API HTTPS, não só para o SSH.

## Suggested fix (optional)

Nada no kata em si. Uma ideia de harness, se alguém quiser triar: fazer o
`kata-docs` falhar alto — uma linha no início da sessão dizendo que o servidor
declarado no `.mcp.json` não subiu — em vez de simplesmente não aparecer na
lista. Hoje a diferença entre "não existe" e "não subiu" é invisível para o
agente.

Registro de crédito, na direção contrária: a sugestão da entrada do review da
#215 (gate condicional ao path, para não subir Postgres e rodar vitest do back
em PR sem mudança de `back/`) **foi adotada** no kumite em `551b443`
("chore: rodar a gate ladder do Stop hook só com mudança de código pendente").
Esta pasta produziu ação pelo menos uma vez.
