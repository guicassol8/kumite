# Review da #97: `parseEnv` confirmou a lacuna de config do kata; `kata verify` e hurl não atrapalharam

**Found while**: review do PR #164 (issue #97 — mensagem legível quando falta
variável de ambiente no back).

**Where in kata**: nenhuma superfície modificada. `kata verify
--strict-coverage` e `pnpm hurl` foram exercitados como gates. MCP `kata-docs`
não consultado (zero queries).

## What

Três observações, nenhum bug no kata.

**1. A superfície de config feita à mão do planejamento agora existe em código,
e ficou boa.** O `task-97-planning-env-failure-surface-kata-cannot-see.md`
previu que a #97 seria um `parseEnv()` caseiro; o PR #164 entregou exatamente
isso — 61 linhas em `back/src/lib/env.ts` que fazem `safeParse`, agregam todas
as variáveis ofensoras numa mensagem, deduplicam por chave, **nunca ecoam o
valor recebido** (`DATABASE_URL`/`JWT_SECRET` são segredos e o valor malformado
carregaria a senha pro stdout do CI) e zeram o `stack` para o vitest não
enterrar a única linha útil. O ponto pro kata é que essas quatro decisões são
genéricas: qualquer app que valide env com zod no import vai reencontrá-las
uma a uma. Um `defineEnv(schema, { subject, hint })` no core resolveria pros
consumidores — em especial o "não ecoe o valor", que é fácil de esquecer e
silenciosamente vaza segredo.

**2. `kata verify --strict-coverage` não reclamou de um arquivo novo em
`lib/`.** 62 arquivos, zero problemas, ~0.7s. Correto: `lib/` não é módulo e
não deve exigir layout `<domain>.route/service/schema`. Registro porque é o
caso "a regra acertou o silêncio", que raramente vira sinal.

**3. Nenhum lookup de docs foi necessário.** A task inteira (config, zod,
vitest) fica fora da superfície do kata. O `kata verify` rodou como gate quatro
vezes sem custo perceptível, e a suíte hurl (14 arquivos, 293 requisições)
passou 100% de primeira depois de `db:migrate` + `db:seed` — sem flake, sem
ordem de arquivo importando.

## Why it matters

Validação de env no import é praticamente universal em apps de backend, e o
modo de falha padrão (`ZodError` cru, uma vez por worker de teste) é ruim o
bastante para gerar uma issue própria — a #97 nasceu de nove dumps
aparentemente desconexos numa review anterior. Se o kata oferecesse a
superfície, cada consumidor deixaria de reimplementá-la, e a parte de "não
vaze o segredo" viria de graça em vez de depender de alguém lembrar.

## Metrics

- Queries ao `kata-docs` MCP nesta review: **0**. Tokens gastos com kata-docs:
  **0** — não houve dúvida de API do kata que precisasse ser resolvida.
- `kata verify --strict-coverage`: 4 execuções, ~0.7s cada. Sem
  falso-positivo, sem falso-negativo detectado.
- `pnpm hurl`: 6.9s para 293 requisições, 14/14 arquivos verdes na primeira
  tentativa.
- Fricção atribuível ao kata: **nenhuma**. O tempo da review foi todo em suíte
  de testes (~95s por rodada da escada) e na verificação manual do critério
  "worktree sem `.env`".

## Suggested fix (optional)

Opcional e já sugerido no relatório de planejamento: um helper de env no core
(`defineEnv` / `parseEnv`) que agregue os issues do zod numa mensagem por
variável, aceite um `hint`, e **garanta por construção** que o valor recebido
nunca entre na mensagem. Se sair, o `back/src/lib/env.ts` do kumite é o
protótipo pronto, com testes.
