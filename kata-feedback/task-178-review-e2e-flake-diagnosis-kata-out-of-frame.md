# Task #178 review (PR #245): diagnóstico de flake no e2e, kata fora de quadro

**Found while**: revisando o PR #245 (editor remonta e perde os blocos do
participante ao trocar de idioma)
**Where in kata**: `kata verify` (gate ladder do pre-commit), `kata-docs` MCP
(não usado)

## What

Review inteiramente front: React (`use-workspace-autosave.ts`,
`problem.$id.tsx`), vitest e Playwright. Nenhuma rota, binding de DI, superfície
de JWT ou shape de erro foi tocada, e o back não foi editado. Nenhum bug do
kata a relatar — três observações e as métricas.

1. **Zero consultas ao `kata-docs`.** Quinta entrada consecutiva front-only
   nesta pasta (#155, #178, #179, #180 e agora este review) sem uma única
   pergunta ao MCP. Não havia o que perguntar. O custo de harness do
   ferramental kata nessas tasks continua perto de zero, que é o
   comportamento desejado.

2. **`kata verify --strict-coverage` rodou 2× neste review** (uma vez manual
   na gate ladder, uma vez pelo pre-commit), ~0,88s cada, sobre 65 arquivos do
   back que esta branch não modifica. Corretamente silencioso — sem falso
   positivo nem falso negativo. Mesma observação da entrada de implementação
   (`task-178-implementing-...`): gatear por "back/ mudou de fato" seria
   otimização, não correção.

3. **O sinal que faltou não era do kata.** O tempo do review foi quase todo
   gasto separando defeito de ambiente num spec de Playwright que falhava 4 em
   6 execuções. O que resolveu foi bisseção manual (probe fora do harness,
   cópia byte-idêntica do spec, A/B contra o commit base) — nada que o kata
   cubra ou devesse cobrir. Registrado aqui só para marcar a fronteira: o
   gargalo de diagnóstico neste repo, hoje, está no e2e do front, não na
   camada do framework. Virou a issue kumite #246.

## Métricas

- Consultas ao `kata-docs` (searches + doc reads): **0**. Tokens gastos nelas:
  **0**. Não pagaram nem deixaram de pagar — não houve pergunta.
- `kata verify`: 2 execuções, ~0,88s cada, 0 achados.
- `pnpm -r test` com o back intacto: 601 testes verdes em ~76s (pre-commit).
- Fração do esforço do review atribuível ao kata: desprezível. Fração
  atribuível a flake de e2e sob pressão de memória: a maior parte.

## Suggested fix

Nenhuma. Entrada de observação e métricas.
