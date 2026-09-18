# Review docs-only: kata fora de quadro de novo, e o pool de redes do Docker esgotado por worktrees mortas

**Found while**: #228 / PR #247 (reviewing) — completar `identity.md` e o canvas
**Where in kata**: nenhum — `kata verify` só como job do pre-commit

## What

PR inteiramente dentro de `docs/design/` (markdown, gerador Python do canvas,
`shot.mjs`/Playwright, PNGs) mais a edição dos corpos de #217, #220 e — durante
o review — #223. Nenhuma linha de `back/`, nenhuma rota, nenhum schema, nenhum
hurl. **Zero consultas ao `kata-docs` MCP**: não houve pergunta a fazer, e
adivinhar não estava em jogo. Custo de contexto com kata-docs nesta sessão: 0
tokens, 0 turnos.

`kata verify --strict-coverage` rodou duas vezes (uma à mão, uma como job do
pre-commit) e foi as duas vezes o job mais rápido da escada: **1,01 s**, contra
29,8 s de `typecheck` e 137,3 s de `test`. Não teve nada a dizer sobre um PR que
não é dele — que é o comportamento correto. Nenhum falso positivo.

Os cinco achados do review saíram todos de leitura do diff e da execução dos
checadores próprios de `docs/design/` (`check_tokens.py`, `check_mark.py`,
`build.py` + `shot.mjs` para reprodutibilidade). Nenhuma superfície de kata
participou de encontrá-los. Sinal registrado como "kata fora de quadro", não
como lacuna.

## A fricção real: o pool de redes do Docker

Como no relato da implementação, o atrito desta sessão não foi kata — foi a
infraestrutura em volta do gate `test`.

- `docker compose up -d` na worktree de review falhou com
  `all predefined address pools have been fully subnetted`: **33 redes bridge**
  no host, ~30 delas `task-*_default` de worktrees já mergeadas e removidas.
  O `docker compose down -v` do fim do ciclo de task não está acontecendo (ou
  não está removendo a rede), e o custo só aparece numa sessão seguinte, como
  um erro que não menciona worktree nenhuma.
- Contorno sem tocar em estado compartilhado: criar um **banco separado dentro
  do Postgres de outra worktree já no ar** (`CREATE DATABASE kumite_review247`
  no container da task-216) e apontar `back/.env` para ele. Isolamento real
  (as tabelas truncadas pelos testes são as do banco novo), sem rede nova e
  sem `docker network prune` num host com outras sessões rodando.
- `VITEST_MAX_FORKS=2` / `VITEST_MIN_FORKS=1` (mais os `*_THREADS`) de novo no
  ambiente antes do `git commit`, pelo mesmo motivo do relato da implementação:
  7 GB de RAM num host com várias sessões de agente. Suíte inteira verde,
  1174 testes, 137 s.

## Suggested fix (opcional, e não é de kata)

Nada a mudar em kata. Para o repo, se valer a pena: o passo de limpeza de
worktree em `docs/workflow.md` já manda `docker compose down -v` — o que falta
é ele ser executado de fato. Um `docker network prune -f` no mesmo passo, ou um
check que conte redes `task-*_default` órfãs, evitaria que a próxima sessão
descubra isso por um erro sem relação aparente.
