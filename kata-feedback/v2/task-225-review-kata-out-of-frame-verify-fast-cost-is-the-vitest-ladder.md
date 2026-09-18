# Review docs-only: kata fora de quadro de novo, e o `kata verify` é a parte barata

**Found while**: #225 / PR #241 — sanear a camada de tokens (reviewing-tasks)
**Where in kata**: nenhuma superfície do kata tocada; `kata verify` só como
gate do lefthook

## What

Observação e métricas, sem bug. Confirma de outro ângulo o que a entrada de
*implementing* desta mesma task já tinha registrado.

O PR muda só `docs/design/` (tokens, spec em prosa, CHANGELOG, READMEs e três
scripts Python do gerador do canvas) mais uma evidência PNG. Zero TypeScript,
zero rota, zero schema, zero DI/JWT/erro. **O `kata-docs` MCP não foi
consultado nenhuma vez durante o review**, e em nenhum momento uma consulta
teria ajudado: o conteúdo revisado é conversão oklch↔sRGB, contraste WCAG 2.x
e coerência de prosa. Um reviewer que tentasse "checar o idioma kata" aqui
estaria inventando trabalho.

Também não houve o que revisar no eixo idiomático do kata (schemas em
`.schema.ts`, `c.error(...)`, serviços puros): o diff não tem back. O único
sinal de back disponível era o `kata verify`, e ele é honesto ao dizer que
não há nada — o que é o comportamento certo.

## Why it matters

Duas tasks seguidas (#226 e #225) e agora dois reviews terminaram com "kata
fora de quadro". Não é crítica ao kata: é sinal de que a regra do kumite de
*tentar* uma entrada a cada task que toca kata está gerando entradas
honestas de "não tocou", o que tem valor para quem fizer a triagem
(distingue "ninguém reportou" de "ninguém tinha o que reportar").

## Metrics

- **`kata-docs` MCP**: 0 consultas, 0 tokens. Não houve dead end porque não
  houve lookup — e a tarefa não pedia nenhum.
- **`kata verify --strict-coverage`**: 3 execuções no review (2 pre-commit +
  1 ladder manual), `no problems found (65 files checked)`, **0,73 s** cada.
  É o degrau mais barato da ladder, com folga.
- **Onde o tempo do review realmente foi** (ladder completa, 3 execuções):
  `pnpm -r test` **76–86 s** por execução contra os 0,73 s do `kata verify` —
  ou seja, o `verify` é ~1% do custo do gate. O `typecheck` fica em ~15 s.
  Num PR docs-only, ~92 s de gate por commit são pagos para provar que nada
  de código mudou. Isso é escolha do kumite (o `lefthook.yml` não filtra por
  glob no job `test`), não do kata — anotado aqui só porque a entrada de
  *implementing* levantou a mesma conta e vale ter o número do review ao lado.
- **Custo do review que importou**: rodar e *falsificar* o `check_tokens.py`
  (stdlib pura, sem kata), e reimplementar WCAG por fora para conferir. Nada
  disso passa perto do framework.

## Suggested fix

Nenhum para o kata. O `kata verify` se comportou bem: rápido, determinístico
e silencioso quando não há back no diff — que é exatamente o que se quer de
um gate que roda em todo commit.
