# Task #181 implementing: correção inteira em Blockly, kata só como gate

**Found while**: #181 — gerador de blocos devolve sucesso para código errado ou fora da allowlist (implementing)
**Where in kata**: `kata verify --strict-coverage`; hurl runner

## What

A task inteira viveu em `@kumite/blocks` (Blockly) e em dois arquivos do back
que só mudaram porque um union de códigos de erro cresceu (`judge.schema.ts`,
`judge.service.ts`). Nenhuma superfície de kata esteve em questão: sem DI, sem
JWT, sem rota nova, sem middleware, sem `c.error` novo além de dois membros em
um `z.enum` já existente. **Zero consultas ao kata-docs MCP** — não houve
pergunta para fazer.

Duas observações, ambas positivas:

1. **`kata verify --strict-coverage` rodou 5× (4 pre-commit + 1 manual) e
   nunca falou nada além de "no problems found (65 files checked)".** Isso é
   o comportamento certo para esta task, mas vale registrar o contraste: o
   arquivo que mais mudou de forma no back foi um `z.enum` de códigos de
   erro, e o `verify` não tem opinião sobre ele. Quem pegou a exaustividade
   foi o `Record<BlocksErrorCode, CodegenErrorCode>` escrito à mão em
   `judge.service.ts` — TypeScript, não kata. É exatamente o desenho que o
   comentário naquele arquivo defende, então não é um pedido de feature;
   é a confirmação de que a rede de segurança aqui é do TS.

2. **O hurl continua sem teardown e sem ser re-executável** (já reportado em
   `task-161-planning-hurl-has-no-teardown-zero-docs-lookups.md`; reencontrado
   na prática desta vez, não só no planejamento). Para rodar `pnpm hurl` com o
   caso novo foi preciso `TRUNCATE` + `db:seed` na mão antes, porque a suíte
   anterior (pre-commit) tinha deixado o banco em outro estado e
   `submissions.hurl` cria `submissions-e2e@edu.pucrs.br` sem limpar. O
   arquivo documenta isso no cabeçalho, o que ajuda — mas é documentação de
   uma limitação, não uma solução.

## Why it matters

O item 1 é sinal de escopo, não de defeito: nem toda task de um projeto kata
toca kata, e vale ter esse dado na amostra em vez de só os casos em que o
framework apareceu.

O item 2 é o mesmo custo de sempre: cada rodada de hurl exige uma sequência
manual de preparo do banco que o runner não oferece. Numa sessão com
pre-commit rodando a suíte inteira (que trunca) entre a edição do `.hurl` e a
execução dele, é fácil rodar contra um banco em estado errado e ler a falha
como regressão do que você acabou de escrever.

## Metrics

- Consultas ao kata-docs MCP: **0**. Tokens gastos nelas: **0**.
- Execuções de `kata verify`: 5 (0,7s–1,4s cada). Todas verdes, nenhuma pegou
  nada — nem falso-positivo, nem achado real. Custo desprezível.
- Execução do hurl: 1, 309 requests / 15 arquivos / 19,8s, verde de primeira
  depois do preparo manual do banco (truncate + seed + subir o server na
  porta da worktree + exportar `ORGANIZER_*`). Preparo: ~4 turnos.
- Gargalo real da task não foi kata: foram os ~2,5 min de gate ladder do
  pre-commit por commit (4 commits ≈ 11 min), dominados pelo vitest do back
  e do front, não pelo `verify`.
- O que realmente pegou os três bugs foi um probe escrito à mão chamando
  `generateSolution` direto — nem kata, nem a suíte existente.

## Suggested fix (optional)

Nenhum para o item 1.

Para o item 2, a mesma ideia já registrada na #161: um hook de setup/teardown
por arquivo `.hurl` (ou um `--before`/`--after` no runner do kata) permitiria
que `submissions.hurl` declarasse o próprio preparo em vez de exigir uma
sequência manual documentada em comentário.
