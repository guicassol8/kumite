# #154 (review): kata fora do quadro de novo — `kata verify` como custo fixo, zero lookups

**Found while**: revisando o PR #165 (wordmark do header vira link para a home)
**Where in kata**: `kata verify --strict-coverage` (via `pnpm verify`)

## What

Segunda metade do par do relatório de implementação
(`task-154-implementing-front-only-kata-cost-was-noise.md`). O review de um PR
100% front confirma a mesma leitura do passo anterior, agora do lado de quem
verifica em vez de quem escreve:

- **Zero consultas ao `kata-docs` MCP** no review inteiro. O diff não tocou
  rota, schema, middleware, DI, JWT nem hurl — não houve uma única decisão de
  review que dependesse de conhecer a API do kata. O custo de contexto do
  kata-docs nesta task foi literalmente 0 tokens, nos dois passos somados.
- `pnpm verify` rodou mesmo assim, por ser degrau fixo do ladder:
  `✓ kata verify: no problems found (61 files checked)`, ~15s, sobre 61
  arquivos de back que ninguém encostou. Passou limpo, como esperado.
- Stage 2 do review pede explicitamente "idiomas do kata no back". Não havia
  back para ler. O checklist de review não tem hoje um caminho curto para
  "este PR não tem superfície kata" — o degrau é executado por completude, não
  por sinal.

## Why it matters

O par implementing+review de uma task sem superfície kata é a **linha de base**
contra a qual as tasks que realmente tocam kata deveriam ser medidas. O número
útil aqui: kata-docs custou 0 e economizou 0; `kata verify` custou ~15s por
execução (×2 no ladder do review, mais as execuções do pre-commit) e produziu
0 achados, porque não havia nada no seu escopo para achar.

Isso não é uma reclamação — um verificador que roda sempre é justamente o que
torna o sinal confiável quando *há* back no diff. O registro serve para que
"kata verify rodou e passou" não seja lido como evidência de qualidade do back
num PR que não tem back nenhum.

## Suggested fix (opcional)

Nada a corrigir no kata. Se algum dia interessar reduzir ruído: `kata verify`
poderia sair com uma nota explícita do tipo "nenhum arquivo sob análise mudou
desde <ref>" quando o diff não intersecta a superfície verificada — informação
para quem lê log de CI, não mudança de comportamento.

## Metrics

| | |
|---|---|
| Consultas ao kata-docs MCP (review) | 0 |
| Consultas ao kata-docs MCP (task inteira) | 0 |
| Tokens gastos em round-trips de kata-docs | 0 |
| `kata verify` no review | 2 execuções, ~15s cada, 61 arquivos, 0 achados |
| Achados de review atribuíveis ao kata | 0 |
| O kata-docs/harness ajudou esta task? | Não se aplicou — sem superfície kata |
