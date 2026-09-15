# Task #168 (review): kata fora de quadro, mas `kata verify` foi o único sinal de back que o review teve

**Found while**: kumite #168 / PR #170 — guarda de rede na suíte vitest do front
**Where in kata**: `kata verify --strict-coverage`; ausência de consulta ao
`kata-docs` MCP

## What

Observação, não bug. O PR #170 é 100% `front/`: um setup file novo do vitest,
quatro arquivos de teste, `vitest.config.ts` e docs. Nenhum `*.schema.ts`,
nenhuma rota, nenhum `.hurl`, nenhum arquivo sob `back/`. Consequência direta
para o review:

- **Zero consultas ao `kata-docs` MCP.** Não houve nenhum momento em que uma
  API do kata precisasse ser conferida — nem para ler o diff, nem para julgar
  idioma. O custo de olhar para o MCP teria sido puro overhead, e a decisão de
  não olhar não custou nenhum turno de retrabalho.
- **`kata verify` virou o único sinal de back disponível.** O review decidiu
  (com o usuário) pular `pnpm -r test` do back — 565 testes que exigem subir
  um Postgres próprio na worktree, para um diff que não toca uma linha de
  back. O que sustentou essa decisão foi `kata verify --strict-coverage`:
  65 arquivos, verde, 0,8 s, sem banco e sem `.env`. Um gate estático,
  barato e sem dependência de infra é exatamente o que um review de diff
  front precisa para afirmar "o back não regrediu" sem pagar o preço de
  provar isso rodando.

Vale registrar o contraste com o feedback da implementação
(`task-168-impl-front-only-kata-gate-cost-on-a-front-task.md`): lá o `verify`
apareceu como custo repetido no `pre-commit` de uma task front; aqui ele
apareceu como o barato que destravou uma decisão. Mesmo comando, mesmo diff,
sinais opostos — a diferença é que no review ele substitui um gate caro, e no
`pre-commit` ele se soma a um.

## Why it matters

Um gate estático que roda sem banco, sem `.env` e em menos de um segundo tem
um uso que não é óbvio na descrição de "linter": ele deixa um reviewer
declarar um pacote intocado como não-regredido sem montar a infra desse
pacote. Isso só funciona porque `verify` não precisa de runtime — se em algum
momento ele passar a exigir uma conexão ou uma env var para rodar, essa
propriedade some, e reviews de diff cross-package ficam mais caros.

## Metrics

- Consultas ao `kata-docs` MCP: **0**. Tokens gastos com kata-docs: **0** de
  ~90 k do review. Não houve dead end nem retrabalho por não ter consultado.
- `kata verify --strict-coverage`: 1 execução, 65 arquivos, verde, ~0,8 s.
- Gate caro evitado graças a ele: `pnpm -r test` do back (565 testes, ~60 s)
  mais o setup de um Postgres dedicado na worktree (~6 turnos, pela medição
  do feedback da implementação).
- Atrito do harness atribuível ao kata: nenhum. O atrito real do review foi
  do lado do shell (um laço `for` em sintaxe fish rejeitado pelo executor) e
  da própria suíte do front (a varredura de isolamento: 61 processos vitest,
  ~9 min de relógio), nada disso ligado ao kata.

## Suggested fix

Nenhum. Registrado como sinal: `kata verify` rodando sem infra é uma
propriedade que vale proteger deliberadamente, não um acidente.
