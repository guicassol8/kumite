# Implementação da #227: nada de kata no caminho, mas `kata verify` rodou 8 vezes

**Found while**: #227 — corrigir o vão do símbolo da identidade e tornar o
gerador do logo executável (implementing-tasks)
**Where in kata**: `kata verify` (só pela via do pre-commit do lefthook); MCP
`kata-docs` não foi consultado

## What

Tarefa 100% fora do frame do kata: os arquivos tocados foram
`docs/design/**` (Python, `.mjs`, Markdown, SVG, PNG, WOFF2). Zero linhas de
`back/`, zero rotas, zero DI/JWT/erro, zero hurl. **Nenhuma consulta ao
`kata-docs` foi feita nem seria útil** — a resposta a toda dúvida do dia estava
em `fontTools`, em CSS `@font-face` e no `FontFaceSet` do Chromium.

A observação que vale registrar é de custo do harness, não do kata: o
pre-commit do kumite roda a escada inteira (`typecheck` → `kata verify
--strict-coverage` → `pnpm -r test`) em **todo** commit, e esta PR tem 8
commits. Então `kata verify` rodou 8 vezes sobre um `back/` que não mudou uma
vírgula, e a suíte inteira (1135 testes) junto.

O `kata verify` em si foi barato e bem-comportado: **0,78 a 1,48 s** por
execução, sempre `✓ no problems found (65 files checked)`, nenhum
falso-positivo. Ele não é o gargalo — quem custa é o `pnpm -r test`
(89 a 123 s por commit). Somando, cerca de **15 minutos de parede** de
regressão pura numa PR que não podia quebrar o back nem em teoria.

Não é bug do kata, e a decisão de rodar tudo em todo commit é do kumite
(`lefthook.yml`, que agentes não podem editar). Fica como dado para quem um dia
pesar um `kata verify --changed-only` ou um gate por escopo de path: o
`verify` já é rápido o bastante para não incomodar; o que pesaria a favor de um
modo incremental é a suíte, não ele.

## Why it matters

Para o kata: nenhum impacto — a ferramenta se comportou. O sinal útil é
**negativo e vale ser dito em voz alta**, porque este repositório acumula
entradas "kata out of frame" e isso pode parecer ruído: um framework de API que
não aparece numa tarefa de ativos de design é exatamente o esperado. Um
`kata verify` que gastasse 10 s, ou que reclamasse de arquivo Python em
`docs/`, apareceria aqui como atrito real. Não apareceu.

## Metrics

- Consultas ao `kata-docs` MCP: **0**. Tokens gastos nele: **0**.
- Tokens do dia: ~100% em geometria SVG/rasterização, `fontTools`, carregamento
  de fonte em `file://` e documentação. Nenhum em superfície kata.
- `kata verify --strict-coverage`: 8 execuções, 0,78 s / 0,85 s / 0,85 s /
  0,97 s / 0,83 s / 0,86 s / 1,48 s / 0,78 s. Sempre verde, 65 arquivos.
- `pnpm -r test` no mesmo pre-commit: 89–123 s por commit, ~15 min somados.
- Turnos perdidos por causa do kata: **0**. Turnos perdidos por rede do
  GitHub (`api.github.com` dando i/o timeout em `gh`, 3 a 5 tentativas por
  chamada): **4** — problema de ambiente, não de kata, já registrado em
  memória do projeto.
- O harness pegou algo real nesta tarefa? Não pelo lado do kata. Quem pegou
  bug de verdade foi o `check_mark.py` escrito nesta própria PR, que mede o
  vão do símbolo em pixel e reprova a geometria antiga.
