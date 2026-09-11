# Fundação da identidade (#216): kata ficou inteiramente fora do caminho

**Found while**: #216 — tokens claro/escuro, fontes Barlow no bundle,
alternância de tema, favicon e componentes de marca (`front/` puro)
**Where in kata**: `kata verify` (só como guarda de regressão); `kata-docs`
MCP não foi consultado uma vez

## What

Task 100% de front: CSS, SVG, `localStorage`, Playwright. Nenhuma rota nova,
nenhum schema, nenhum `.hurl`, nenhuma superfície de DI/JWT/erro. O kata
apareceu só como degrau da escada de portões — `kata verify --strict-coverage`
rodou em todo commit (11 execuções, 65 arquivos, entre 0,7 s e 2,0 s cada) e
passou limpo todas as vezes, confirmando que o `back/` não regrediu por tabela.

Observação sobre o harness, não sobre o kata: a máquina (7,1 GB de RAM) entrou
em exaustão com 9 containers Postgres de worktrees paralelas no ar. O resultado
foi `exit 137` em três `git commit` seguidos (o hook de pre-commit sendo morto
pelo OOM killer, uma vez levando o VSCode junto) e falhas fantasma do vitest com
`Test timed out in 5000ms` em testes que levavam 8–20 s — starvation de worker,
não regressão. `VITEST_MAX_THREADS=2` resolveu: o mesmo ladder caiu de 184 s
para 145 s e parou de flakar. O `kata verify` nunca foi o gargalo — sempre
menos de 2 s dentro de um ladder de 3 minutos.

## Why it matters

Serve como linha de base do custo passivo do kata numa task que não o toca:
~2 s por commit, zero falsos positivos, zero consultas à documentação. É o
comportamento desejado — o framework não cobrou nada de quem não estava
mexendo nele.

Para quem trocar o `kata verify` de lugar na escada: ele é barato o bastante
para rodar cedo, antes do vitest, e foi o único sinal do `back/` disponível
numa task que não abriu o `back/` uma única vez.

## Metrics

- Consultas ao `kata-docs` MCP: **0**. Custo de contexto: **0 tokens**.
  Nenhuma pergunta sobre kata surgiu — o plano aprovado já delimitava a task
  como front-only e o acerto se confirmou.
- `kata verify --strict-coverage`: 11 execuções, 65 arquivos, 0,74 s–1,96 s,
  todas verdes.
- Escada de portões por commit: ~3 min sob contenção de memória, ~2 min depois
  de limitar os workers do vitest. A fatia do kata: ~1 %.
- Turnos perdidos para atrito de ambiente (OOM, reboot, re-seed do banco após
  o pre-commit truncar): ~8. Turnos perdidos para kata: **0**.
