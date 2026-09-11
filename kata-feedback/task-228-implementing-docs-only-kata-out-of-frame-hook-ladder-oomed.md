# Implementação docs-only: kata fora de quadro, mas a escada de gates do hook derrubou a máquina duas vezes

**Found while**: #228 (implementing) — completar `identity.md` e o canvas
**Where in kata**: nenhum — `kata verify` só como job do pre-commit

## What

Task inteiramente dentro de `docs/design/` (spec em markdown, gerador Python
do canvas, `shot.mjs`/Playwright, PNGs) mais a edição dos corpos de #217 e
#220. Nenhuma linha de `back/`, nenhuma rota, nenhum schema, nenhum hurl.
Zero consultas ao `kata-docs` MCP — não houve pergunta a fazer.

`kata verify --strict-coverage` rodou em **todos** os 8 commits, como job do
`pre-commit`, e foi sempre o job mais rápido da escada: 0,93 s a 2,27 s,
contra 20–54 s do `typecheck` e 107–210 s do `test`. Nunca falhou e nunca
teve nada a dizer sobre esta task — o que é o comportamento correto: ele não
inventou problema em código que não é dele.

A fricção real desta sessão não foi kata, foi a escada inteira do hook num
commit docs-only. Fica registrado porque `kata verify` é um dos quatro jobs e
o relato é do conjunto:

- A máquina tem **7 GB de RAM** e ~1 GB livre (um `wireplumber` vazando
  1,3 GB, mais várias sessões de agente em paralelo; load average chegou a
  **21 num host de 8 cores**). `pnpm -r test` com vitest em default de workers
  estourou a memória e foi **morto com exit 137 duas vezes**, derrubando junto
  o VS Code que hospedava a sessão — duas vezes.
- Antes disso, três commits falharam com `Test timed out in 5000ms` em
  `front/src/routes/organizer.rounds.index.test.tsx`, que passa sozinho. É
  starvation de worker, não regressão.
- Fixar `VITEST_MAX_FORKS=2 VITEST_MIN_FORKS=1` (mais os equivalentes
  `*_THREADS`) no ambiente antes do `git commit` resolveu **e ficou mais
  rápido**: o job `test` caiu de ~200 s para ~110 s, porque parou de brigar
  por CPU e memória consigo mesmo.

## Why it matters

Para kata, o sinal é positivo e vale registrar como tal: `kata verify` é
barato o suficiente (~1 s) para rodar em todo commit sem que ninguém pense em
pulá-lo, e é silencioso quando a task não toca a superfície dele. É o oposto
do custo do `test` na mesma escada.

O risco que isso ilumina está na composição, não em kata: quando um dos jobs
da escada custa 200 s e pode matar o host por OOM, a pressão para burlar o
hook inteiro (`--no-verify`) recai também sobre o job de 1 s que não tinha
culpa nenhuma. Um consumidor de kata que sofra isso tende a tirar o
`kata verify` do pre-commit junto com o resto.

## Metrics

- Consultas ao `kata-docs` MCP: **0**. Tokens gastos nele: **0**. Não houve
  custo de lookup a comparar com o total da task, porque não houve lookup —
  e nesta task isso foi o certo, não uma omissão.
- `kata verify --strict-coverage`: 8 execuções, 0,93 s–2,27 s, 65 arquivos,
  0 achados. Tempo total acumulado: ~12 s.
- Comparação na mesma escada, por commit: `typecheck` 20–54 s, `test`
  107–210 s, `format` ~1,5 s.
- Commits perdidos para flake/OOM antes de estabilizar os workers: **5**
  (3 timeouts de 5000 ms, 2 exit 137). Custo aproximado: ~15 min de relógio
  e dois crashes do editor.

## Suggested fix (optional)

Nada a corrigir em kata. Se algo, vale como argumento a favor de manter
`kata verify` barato e sem dependência de banco: é o que permite que ele
sobreviva numa escada de pre-commit que, de resto, é cara demais para a
máquina que a roda.
