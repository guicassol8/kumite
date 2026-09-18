# `kata verify --strict-coverage` passa limpo num rate limiter que não segura sob concorrência

**Found while**: review do PR #146 (issue #142 — rate limit e paridade de
tempo nas rotas públicas de reset de senha)
**Where in kata**: `kata verify` (incl. `--strict-coverage`), e a ausência de
qualquer noção de "seção crítica" nas regras de service

## What

O PR implementava uma janela deslizante em Postgres com `consumePasswordResetBudget`:
`DELETE` de expiradas → `SELECT count()` por e-mail → `SELECT count()` por IP →
`INSERT`. Quatro statements, sem transação e sem lock.

`kata verify --strict-coverage` passou limpo (60 arquivos), `tsc` limpo, biome
limpo, e os 420 testes passavam — porque todos os testes do balde eram
sequenciais (`for` + `await`). Medido na rota de verdade, 25 requests
simultâneos para o mesmo endereço emitiram 10 códigos e enviaram 10 e-mails
contra um teto de 3.

Nada nesse conjunto de ferramentas tinha como pegar isso, e não estou dizendo
que deveria pegar automaticamente — o ponto é outro: **o `verify` limpo é lido
como sinal de que a camada de service está OK**, e nesse caso ele estava limpo
sobre um limitador que não limitava. A observação é sobre o que o selo verde
comunica, não sobre uma regra faltando.

## Why it matters

O `kata verify` ocupa, no fluxo do kumite, o lugar de "revisor automático da
camada de service" — é o que os hooks PostToolUse/pre-commit rodam e é o que o
`AGENTS.md` do back manda usar. Ele é ótimo no que promete (layout de módulo,
schemas fora da rota, `c.error`, serviços puros), e todas essas regras
passaram corretamente aqui.

O risco é de leitura: um agente que vê `✓ kata verify: no problems found` mais
suíte verde tende a tratar a service como revisada. Um read-then-write sem
transação num serviço que existe exatamente para *contar e limitar* é o tipo
de defeito que sobrevive a todos os portões e só aparece se alguém pensar em
disparar as chamadas em paralelo.

Não é bug do kata. É um limite que talvez valha a pena tornar explícito.

## Metrics

- **Consultas ao `kata-docs` MCP neste review: 0.** Nada no diff dependia de
  API do kata que eu não pudesse confirmar lendo o código do próprio repo
  (`defineRoute`, `c.error`, `c.raw`, o layout de módulo). O `.route.ts`
  mudou 3 linhas e o padrão já estava no arquivo. Custo de lookup: zero, e não
  senti falta — coerente com o
  `task-142-implementation-zero-docs-lookups.md` que a implementação registrou.
- **`kata verify --strict-coverage`**: ~0,67 s nas duas execuções (antes e
  depois do fix). Sem atrito, sem falso-positivo. Rodou 3× no total (2 manuais
  + 1 no pre-commit).
- **Onde o tempo do review foi de verdade**: subir a stack isolada da worktree
  (Postgres 5446 + API 3046, migrate + seed) e as medições ao vivo — a rajada
  paralela e a paridade de tempo. Uns 15 min de relógio, e foi exatamente aí
  que o único achado real apareceu. Nenhuma ferramenta estática apontou nessa
  direção.
- **Falso-negativo notável**: o `--strict-coverage` passou limpo nas duas
  versões do arquivo — a que perdia o teto sob concorrência e a corrigida.

## Suggested fix (optional)

Nenhum fix pedido; o valor aqui é o registro. Se alguém quiser agir:

- Uma regra que apontasse `SELECT count(...)` seguido de `INSERT`/`UPDATE` na
  mesma tabela, no mesmo service, fora de `db.transaction`, pegaria essa
  família inteira. Provavelmente barulhenta demais para ser erro; talvez
  caiba como aviso opt-in.
- Alternativa mais barata e sem heurística: uma linha na doc de services do
  kata dizendo que `verify` não modela concorrência, para o selo verde não ser
  lido como mais do que promete.
