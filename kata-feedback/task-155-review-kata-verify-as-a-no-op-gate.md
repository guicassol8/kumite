# Review da #155 (PR #160): kata verify como portão no-op, e o custo real do review

**Found while**: review do PR #160 (#155 — ancorar a barra de ações em `/problem/$id`)
**Where in kata**: `kata verify --strict-coverage`, `kata-docs` MCP (não consultado)

## What

Observação, sem bug — o lado do *review* do contraponto que a entrada de
implementação (`task-155-pure-front-implementation-kata-only-as-a-gate.md`)
já registrou.

O PR não encosta em `back/`: `front/src/index.css`,
`front/src/routes/problem.$id.tsx`, dois componentes, dois specs e PNGs de
evidência. Mesmo assim o review roda `pnpm verify` na escada de portões, e
o `pre-commit` roda de novo na commit do fix. Duas execuções,
`✓ no problems found (61 files checked)`, 0,87s no hook. **Zero consultas ao
`kata-docs` MCP** — de novo, não houve pergunta a fazer.

O achado do review (faixa de resultados colapsando para 0px em telas com
menos de 700px de altura) só apareceu por medição no browser: nem
`kata verify`, nem o vitest, nem o typecheck têm como enxergar geometria.
Isso não é crítica ao kata — é fora do escopo dele —, mas vale registrar
que **para bugs de layout a escada inteira de portões é verde e silenciosa**,
e a única rede é o Playwright.

## Why it matters

Reforça o sinal da entrada de implementação: em task de front puro o
`kata verify` é barato e o `kata-docs` é irrelevante, e não consultá-lo é a
decisão certa e não uma omissão. Se alguém for medir "quanto o kata custa
por commit no kumite", estas duas entradas juntas dão a série completa de
uma task inteira (implementação + review) sem uma única linha de `back/`.

## Metrics

- Consultas ao `kata-docs` MCP no review: **0** (0 tokens).
- `kata verify`: 2 execuções (1 na escada manual, 1 no `pre-commit`), ambas
  verdes, 61 arquivos, 0,87s medido no hook.
- Fração do tempo de portão gasta em kata na commit do fix: **0,8%**
  (0,87s de kata-verify em 111,6s de hook — `test` 93,4s, `typecheck` 16,9s,
  `format` 0,45s).
- Turnos gastos por causa do kata: **0**. Turnos gastos medindo layout no
  Playwright para achar e fechar o bug: **6** (3 rodadas de probe + 2 de
  suíte + 1 de screenshot), de longe o custo dominante do review.
- Fricção não-kata que vale registrar: uma rodada de probe do Playwright
  morreu com **exit 137 (OOM)** com `workers: 2` e dois dev servers de pé na
  mesma máquina; repetir com `--workers=1` resolveu. É config do kumite, não
  do kata.

## Suggested fix (optional)

Nada do lado do kata.
