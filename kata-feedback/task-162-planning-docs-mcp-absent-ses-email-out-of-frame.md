# kata-docs MCP ausente da sessão (4ª ocorrência) — task de e-mail SES não precisou dele

**Found while**: planejamento da issue #162 (kumite) — corpo HTML e link
absoluto no e-mail de redefinição de senha
**Where in kata**: `@katajs-framework/docs-mcp` (MCP server), `kata verify`

## What

Duas observações independentes:

1. **O servidor `kata-docs` não subiu nesta sessão.** O `.mcp.json` do
   repo declara `npx -y @katajs-framework/docs-mcp`, mas nenhuma ferramenta
   `mcp__kata-docs__*` apareceu na lista de ferramentas disponíveis; um
   `ToolSearch` por `select:mcp__kata-docs__search_docs,...` retornou
   "No matching deferred tools found". Outros servidores MCP da sessão
   (Figma, Gmail, ClickUp) apareceram normalmente, então não é falha
   genérica de MCP. Este é o quarto registro do gênero nesta pasta
   (`kata-docs-mcp-connect-timeout-during-planning.md`,
   `task-143-...docs-mcp-down-again...`,
   `task-98-...docs-mcp-down-third-time...`).

2. **A task não tinha superfície de kata mesmo.** #162 é AWS SES
   (`@aws-sdk/client-ses`), uma env var nova no `config.ts` (zod puro) e
   HTML inline — nada de rota, DI, JWT, middleware ou envelope de erro. A
   ausência do servidor custou zero neste caso; registro só para não
   quebrar a série de observações sobre a disponibilidade dele.

Nota lateral sobre `kata verify`: rodei `npx kata verify --json` como
sanity check durante a exploração e ele respondeu `{}` — objeto vazio, sem
campo algum indicando "0 problemas", "N regras avaliadas" ou sequer um
`ok: true`. Sucesso e "não avaliei nada" são indistinguíveis nessa saída.

## Why it matters

O ponto 1 sozinho já é padrão o bastante para merecer uma olhada humana: em
quatro sessões distintas de planejamento o `kata-docs` esteve indisponível.
Se a expectativa é que agentes consultem o MCP antes de chutar qualquer API
do kata, a disponibilidade dele é pré-requisito da regra — hoje o fallback
efetivo tem sido ler o fonte em `~/Projetos/kata`.

O `{}` do `--json` importa para automação: um hook que queira distinguir
"verify passou" de "verify não rodou regra nenhuma" não consegue fazer isso
pela saída atual sem inspecionar o exit code separadamente.

## Metrics

- Consultas ao kata-docs nesta task: **0** (servidor indisponível; 1
  tentativa de `ToolSearch`, ~200 tokens, sem retorno útil).
- Documentos do kata lidos: 0. Fonte do kata lido: 0.
- Custo da indisponibilidade nesta task: **nenhum** — o planejamento não
  tocou superfície de kata em momento algum.
- Turnos gastos com kata no total: 1 de ~12 (a chamada de `kata verify`
  como sanity check, que também mudou o cwd da sessão e exigiu um turno
  extra para voltar à raiz).

## Suggested fix (optional)

Para o `--json`: emitir sempre algo explícito, mesmo no caminho feliz —
`{ "ok": true, "rules": <n>, "findings": [] }`. Um `{}` não distingue
sucesso de no-op.

Para o MCP: nenhuma sugestão concreta daqui (não investiguei a causa — o
servidor simplesmente não apareceu). O padrão de 4 ocorrências é que vale a
triagem.
