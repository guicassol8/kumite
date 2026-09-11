# Task docs-only: kata fora de quadro, mas o pre-commit cobra a conta inteira

**Found while**: #225 — sanear a camada de tokens de `docs/design/`
(implementing-tasks)
**Where in kata**: nenhuma superfície do kata tocada; `kata verify` só como
gate do lefthook

## What

Observação, não bug. A #225 mudou exclusivamente `docs/design/` — dois
arquivos de token, `identity.md`, dois README, o CHANGELOG e três scripts
Python do gerador do canvas. **Zero linhas de TypeScript**, zero rotas, zero
schema, zero DI/JWT/erro. O `kata-docs` MCP não foi consultado nenhuma vez, e
não houve momento em que uma consulta teria ajudado: a tarefa é conversão de
cor, contraste WCAG e prosa de spec.

`kata verify --strict-coverage` rodou 9 vezes assim mesmo (8 commits + o
`pnpm check` final), sempre com o mesmo resultado — `no problems found
(65 files checked)`, 0,8–1,1 s cada. Correto: não há nada a reportar quando
nada de back mudou. O custo real não é o `kata verify`, é o `pnpm -r test`
que vem junto no mesmo hook.

## Why it matters

O gate do lefthook é incondicional: todo commit paga typecheck + kata verify
+ as três suítes de teste. Nesta task isso deu **~2,5 min por commit, ~20 min
no total**, para mudanças que nenhum teste cobre e que nenhum gate conseguiria
reprovar. Some-se a isso que rodar `pnpm -r test` exige um Postgres vivo, o
que me obrigou a subir um container próprio na porta 5443 (as 5439 e 5441 já
estavam ocupadas por outras worktrees) e rodar as migrations — tudo isso para
commitar arquivos `.md`, `.json`, `.css` e `.py`.

Nada disso é culpa do kata: o `kata verify` é a etapa mais barata das quatro
e a única que já se adapta ao escopo (checa 65 arquivos de back e cala a
boca). É sinal a favor dele, e sinal contra o gate que o embrulha.

O ponto de comparação útil: o Stop hook do kumite **já** foi ajustado para
rodar a ladder só quando há mudança de código pendente (commit `551b443`,
"rodar a gate ladder do Stop hook só com mudança de código pendente"). O
pre-commit do lefthook não recebeu o mesmo tratamento. Isso é trabalho de
kumite, não de kata — registro aqui só porque a métrica saiu desta task e
porque o contraste "kata verify custa 1 s / a ladder custa 150 s" é a
observação que interessa a quem mede o custo do harness.

## Metrics

- consultas ao `kata-docs` MCP: **0** (searches 0, doc reads 0, ~0 tokens)
- teria valido a pena consultar? **Não** — kata fora de quadro por completo
- `kata verify`: 9 execuções, 0,76–1,14 s, sempre `no problems found
  (65 files checked)`, 0 falso-positivo
- ladder completa por commit: ~150 s (typecheck ~28 s · kata verify ~1 s ·
  testes ~120 s), × 8 commits ≈ 20 min
- fração do `kata verify` no custo do gate: **< 1 %**
- hurl: não rodou (nenhuma rota mudou)
- atrito fora do kata: subir Postgres próprio (porta 5443, 3ª tentativa) +
  `db:migrate` como pré-requisito para commitar arquivos de documentação
- ferramenta que de fato pegou erro nesta task: um script stdlib de 400
  linhas escrito na própria task (`check_tokens.py`), não um gate existente
