# Review de bug de corrida no ranking: kata fora do frame, e um byte NUL cru cegando o diff

**Found while**: #176 / PR #240 — submissão aceita no último segundo da rodada
era descartada dos rankings (reviewing-tasks)
**Where in kata**: `kata verify` (só como gate), `kata-docs` MCP (não usado)

## What

Review de uma task que não encosta em superfície de kata: coluna nova em
drizzle + backfill SQL, escopo de query, estado module-level para segurar um
evento SSE. **Zero consultas ao `kata-docs`** — nenhuma pergunta sobre API de
kata apareceu durante a leitura do diff nem durante a produção de evidência.
`kata verify --strict-coverage` rodou limpo (65 arquivos, ~1s), sem achados.

O achado do review que vale registrar não é sobre kata, é sobre o que *nenhum*
gate do ladder viu:

**`back/src/modules/ranking/ranking.service.ts` contém dois bytes NUL (0x00)
crus**, usados como separador de chave composta em template literals
(`` `${row.teamId}\0${row.key}` ``, escrito com o byte literal em vez do escape
`\0`). Consequência: **o git classifica o arquivo como binário**. `git diff`
imprime `Bin 11407 -> 10985 bytes` em vez do diff, `grep` trata como binário, e
a aba de diff do GitHub não renderiza o arquivo.

Isso é **pré-existente no `develop`** (confirmado em
`git show origin/develop:...`), não foi introduzido pelo PR #240 — mas o PR
altera justamente esse arquivo, e é o arquivo central da correção. Ou seja: o
review do trecho mais importante da mudança só foi possível forçando
`git diff --text`. Um reviewer humano olhando o PR no GitHub veria o arquivo
como binário e simplesmente não leria a mudança.

Nem `kata verify --strict-coverage`, nem `tsc`, nem o biome, nem o lefthook
disseram uma palavra. O TypeScript aceita o byte porque é um caractere válido
dentro de uma string.

## Why it matters

Para o kumite: é uma armadilha de revisão silenciosa. O arquivo seguirá
invisível em todo PR futuro que o toque, e `ranking.service.ts` é exatamente
onde moram os achados #3 (este) e #9 (times fantasma) do diagnóstico.

Para o kata, como pergunta aberta e não como pedido: **um lint de "byte de
controle cru em arquivo-fonte" cabe no `kata verify`?** É barato (uma varredura
de bytes por arquivo já lido), o falso-positivo é praticamente nulo — nenhum
código-fonte legítimo tem 0x00 literal — e o sintoma (arquivo vira binário para
o git, some do code review) é caro e completamente mudo. Vale também para
U+2028/U+2029, que têm o mesmo perfil: invisíveis, válidos para o parser,
destrutivos para tooling a jusante.

Se a resposta for "isso é papel do linter genérico, não do kata", está ótimo —
vale só registrar que na prática o biome deste repo também não pegou.

## Metrics

- **Tokens/turnos gastos com kata-docs**: zero. MCP não invocado; nenhuma
  dúvida de kata surgiu no review.
- **`kata verify`**: 1 execução, ~1s, 65 arquivos, nenhum achado. Custo
  desprezível, ganho nulo *neste* review — resultado correto, mas não é sinal.
- **Custo do byte NUL no review**: ~4 rodadas de ferramenta até entender por
  que o arquivo aparecia como `Bin` no `--stat` (file → grep → xxd → perl para
  localizar linha/coluna), antes de conseguir ler o diff com `--text`. Todo
  esse tempo foi diagnóstico de tooling, não de código.
- **Onde o tempo do review realmente foi**: suíte completa (~85s back, ~29s
  front) + hurl (12.5s, 315 requests) + verificação manual do backfill em dois
  bancos descartáveis. O kata é ~1% do wall clock.
- **Achados reais do review**: 1 (o byte NUL), pré-existente e fora do escopo
  do PR. Origem: `git diff --stat` mostrando `Bin`. Nenhum gate automatizado.
