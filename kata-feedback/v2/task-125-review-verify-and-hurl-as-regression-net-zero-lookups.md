# Review #125: `kata verify` e hurl como rede de regressão de uma mudança puramente de banco — zero lookups no kata-docs

**Found while**: #125 / PR #169 — índice único em `event_codes.university` (review)
**Where in kata**: `kata verify --strict-coverage`, `pnpm hurl`

## What

Observação, não bug — e o terceiro registro da mesma issue (planejamento e
implementação já têm o seu), agora do ponto de vista de quem revisa em vez de
quem escreve.

O diff do PR não toca nenhuma superfície do kata: um `uniqueIndex` no schema
drizzle, a migration gerada, um teste vitest e comentários. Rota, schema zod,
DI, JWT e formato de erro seguem idênticos — o contrato tipado do front nem
percebeu a mudança. Consequência: **zero consultas ao `kata-docs` MCP durante
o review**, pelo mesmo motivo das duas entradas anteriores desta issue. Não
havia pergunta de framework a fazer, e inventar uma teria sido overhead puro.

O que o kata fez de útil aqui foi agir como rede de regressão barata para uma
mudança que **não é dele**:

- `kata verify --strict-coverage` — verde, 65 arquivos, sem achados e sem
  falso positivo em cima do `pgTable` de três argumentos (a mudança de forma
  do schema drizzle poderia plausivelmente confundir uma regra de layout de
  módulo; não confundiu).
- `pnpm hurl` — 15 arquivos, 301 requests, 7.7s, 100% verde de primeira contra
  o servidor da worktree, **sem nenhuma edição de `.hurl`**. Esse é o sinal que
  mais valeu no review: a suíte exercita `event-codes` de ponta a ponta (14
  requests) e passar intocada é evidência direta da alegação central do PR —
  "nenhuma mudança de comportamento". Verificar isso lendo código teria custado
  muito mais turnos e concluído menos.

Vale registrar também um quase-atrito que **não** apareceu: o índice novo
transforma um `ON CONFLICT DO NOTHING` sem target (`db/seed.ts`) em algo que
passa a absorver uma violação diferente da que absorvia antes. Nem o
`kata verify` nem o hurl enxergam esse tipo de acoplamento — é semântica de
drizzle/Postgres, fora do escopo do kata — então foi verificado à mão
(renomear o código, re-seedar, conferir a contagem de linhas). Não é cobrança:
é a delimitação de onde a rede do kata termina numa task de banco.

## Why it matters

Reforça um padrão já registrado várias vezes: para tasks de schema/migração o
kata é infraestrutura silenciosa, e o custo de consultar o `kata-docs` seria
overhead. Mas o review acrescenta um ângulo que as entradas de planejamento e
implementação não tinham — o valor do hurl **como evidência de não-regressão**,
não só como teste. Numa task cuja alegação é "nada mudou de comportamento", uma
suíte de integração que passa sem edição é o argumento mais forte disponível, e
foi o mais barato de produzir. O kata não participou da mudança e ainda assim
pagou seu custo no review.

## Metrics

- Consultas ao `kata-docs` MCP: **0** (searches e doc reads), custo **0 tokens**
  de um review de ~65k tokens de contexto. Nenhuma dúvida de framework ficou
  sem resposta por causa disso.
- `kata verify --strict-coverage`: verde, 65 arquivos, <1s. Zero falsos
  positivos apesar da mudança de forma do `pgTable`.
- `pnpm hurl`: 7.70s, 15 arquivos, 301 requests, 100% verde na primeira
  execução, zero edições de `.hurl`.
- Escada completa do review (typecheck → verify → test → hurl): ~2min,
  dominada pelo vitest (68s back + 33s front). A fatia do kata é ~7% (quase
  toda hurl), e foi a parte que produziu a evidência de fato.
- Turnos gastos em atrito de kata: **0**. Os turnos manuais do review foram
  em `psql` (confirmar o índice, provar a recusa, testar idempotência do
  seed) — território drizzle/Postgres, fora do frame do kata.

## Suggested fix

Nada para o kata. A ideia especulativa registrada na entrada de implementação
desta issue — uma regra opcional no `kata verify` que aponte serviços cujo
pressuposto de unicidade não tem índice correspondente no schema drizzle —
continua de pé e o review não acrescenta evidência nova a favor nem contra;
exigiria o kata enxergar o schema do drizzle, o que hoje está fora do escopo.
