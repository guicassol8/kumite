# Task #155: implementação 100% front — kata só apareceu como portão

**Found while**: #155 (ancorar a barra de ações e os resultados em `/problem/$id`)
**Where in kata**: `kata verify` (via hook pre-commit), nada mais

## What

Observação, sem bug. A task foi puramente de layout no `front/`: quatro
arquivos de React/Tailwind e um spec de Playwright. Nenhuma rota nova,
nenhum schema, nenhum `.hurl`, nenhuma superfície de DI/JWT/erro tocada.
Consequência: **zero consultas ao `kata-docs` MCP** — não houve pergunta
para fazer a ele.

kata apareceu só como portão: `kata verify --strict-coverage` roda no
`pre-commit` do lefthook em toda commit, inclusive nas que não encostam em
`back/`. Rodou 5 vezes, entre 0,44s e 2,39s, sempre `✓ no problems found
(61 files checked)`. Nenhum falso positivo, nenhuma fricção.

O que custou tempo na task não foi kata: foi a suíte do `back/` dentro do
mesmo hook (~100s por commit) e um flake dela — `auth.test.ts >
changePassword > swaps the password and clears the forced-change flag`
estourou o timeout de 5s em 2 de 6 execuções, passando sozinho logo em
seguida. É teste do kumite, não do kata, mas vale registrar aqui porque o
efeito prático é "o portão do kata parece lento/instável" quando na verdade
o kata é a parte rápida dele.

## Why it matters

Sinal de que o custo do `kata verify` no hook é desprezível mesmo em tasks
que não são de back — o overhead percebido do portão vem de outro lugar.
Também é um contraexemplo útil ao pressuposto de que "task de kumite ⇒
consulta ao kata-docs": para trabalho puramente de front o MCP não tem
papel, e não fazer a consulta foi a decisão certa, não uma omissão.

## Metrics

- Consultas ao `kata-docs` MCP: **0** (0 tokens). Nenhuma pergunta surgiu.
- `kata verify`: 5 execuções no pre-commit, 0,44s / 0,77s / 0,83s / 0,93s /
  1,00s / 2,39s. Sempre verde, 61 arquivos.
- Fração do tempo do hook gasta em kata: ~1–2% (o resto é `pnpm -r typecheck`
  ~15–50s e `pnpm -r test` ~80–100s).
- Turnos gastos por causa do kata: 0. Turnos gastos re-rodando a suíte por
  causa do flake do `auth.test.ts`: 2.

## Suggested fix (optional)

Nada do lado do kata. Se algum dia o `kata verify` do hook virar caro,
condicioná-lo a `back/**` nos `glob` do lefthook seria o corte natural —
hoje não compensa a complexidade.
