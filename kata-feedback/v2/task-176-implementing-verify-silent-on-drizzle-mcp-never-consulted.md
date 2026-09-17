# Implementação de bug de corrida no ranking: kata fora do frame, MCP nunca consultado

**Found while**: #176 — submissão aceita no último segundo da rodada era
descartada dos rankings (implementing-tasks)
**Where in kata**: `kata verify` (só como gate), `kata-docs` MCP (não usado)

## What

Task inteiramente dentro de superfícies que o kata não cobre: coluna nova em
drizzle + backfill em SQL puro, escopo de query, e estado module-level em
serviço para segurar um evento SSE. **Zero consultas ao `kata-docs`** — não
houve um só momento em que uma pergunta sobre kata aparecesse. Nenhuma rota
nova, nenhum schema de `input`/`output` novo, nenhum middleware, nenhum
`c.error`. A única mudança em `.route.ts` foi trocar uma chamada de publish
por outra, ambas de módulo do próprio kumite.

`kata verify --strict-coverage` rodou limpo nas três vezes (65 arquivos, ~1-2s)
e não teve nada a dizer — o que é o resultado correto, só não é sinal.

Duas observações que valem registro, nenhuma delas culpa do kata:

1. **O gate que pegou coisa foi o `tsc`, não o `kata verify`.** Tornar
   `submissions.round_id` NOT NULL quebrou 19 fixtures de teste em 6 arquivos,
   todas apontadas pelo typecheck com o nome da propriedade faltando. Foi o
   feedback mais útil do ciclo inteiro e veio do TypeScript/drizzle.

2. **`drizzle-kit migrate` falhou em silêncio absoluto** — exit 1, stdout com
   o spinner de "applying migrations..." e stderr *vazio*. O erro real
   (`invalid reference to FROM-clause entry for table "s"`, um `LATERAL` que
   não pode referenciar a tabela-alvo de um UPDATE) só apareceu aplicando o
   `.sql` à mão via `psql`. Isso é drizzle, não kata, mas é a mesma família do
   que já está registrado em
   `kumite-drizzle-migrate-false-failure-and-stale-worktree-db`: o exit code
   do drizzle-kit não é confiável em nenhuma das duas direções. Vale ter isso
   no radar de quem for comparar ergonomia de migration entre kata e drizzle.

## Why it matters

Sinal de cobertura, não de defeito: mais uma implementação em que o kata ficou
fora do frame. O padrão acumulado nestes relatórios (várias entradas de
planning com "kata out of frame", "zero docs lookups") sugere que boa parte do
trabalho de feature no kumite acontece em drizzle + lógica de domínio, com o
kata concentrado na borda HTTP. Se isso for representativo, o investimento em
`kata-docs` rende mais em tasks que criam ou mudam rota do que em tasks de
correção de lógica.

O ponto 1 é o que eu levaria para o kata como pergunta aberta: numa mudança de
schema que quebra 19 call sites, o que o `kata verify` poderia ter dito que o
`tsc` já não disse? Se a resposta for "nada", está certo assim — mas então o
`verify` nessas tasks é ritual barato, não rede de segurança, e não há problema
nenhum nisso desde que ninguém confunda "verify verde" com "mudança conferida".

## Metrics

- **Tokens/turnos gastos com kata-docs**: zero. MCP não foi invocado nenhuma
  vez; nenhuma pergunta sobre API de kata surgiu no ciclo.
- **`kata verify`**: 3 execuções (2 no pre-commit, 1 manual), ~0.9-1.9s cada,
  65 arquivos, nenhum achado. Custo desprezível, ganho nulo *nesta* task.
- **Gate ladder completa (pre-commit)**: ~172s e ~174s nos dois commits. O
  `verify` é ~1% disso; os testes são ~85% (145s). O atrito real do ciclo é a
  suíte de testes, não o kata.
- **Onde o tempo de depuração foi**: ~4 rodadas de ferramenta para achar o erro
  do `LATERAL` na migration de backfill, todas contra `psql` direto, porque o
  `drizzle-kit` não imprimiu o erro. Nenhuma delas envolveu kata.
- **Achado real do harness**: 1 — o typecheck apontando as 19 fixtures.
  Origem: `tsc`.
