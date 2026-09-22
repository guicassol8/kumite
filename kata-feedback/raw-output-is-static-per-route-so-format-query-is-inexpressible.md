# `raw()` é estático por rota, então `?format=json|csv` é inexprimível — e as docs não dizem isso

**Found while**: planejamento da kumite #278 (export do evento em JSON e CSV);
a issue deixava explicitamente para o planejamento "decidir a forma que fica
melhor no kata".
**Where in kata**: `raw()` / `OutputSpec` / `RouteHandlerReturn`
(`dist/context-*.d.ts`), `guide/routes-schemas.md` § *Non-JSON responses:
`raw()`*, ADR-0024.

## What

O `raw(contentType, schema)` do 0.4.2 resolve o caso "esta rota devolve CSV"
muito bem, e o exemplo `/users.csv` da guide é quase exatamente o que a kumite
precisava. O que a documentação **não** diz, e que é a decisão de desenho que
importa na hora de projetar uma rota de export, é a consequência de `output`
ser resolvido em tempo de tipo:

```ts
type RouteHandlerReturn<O extends OutputSpec> =
  O extends RawOutput ? Response
  : O extends z.ZodTypeAny ? SuccessOutput<O>
  : SuccessOutput<O> | Response
```

Como `O` é fixo por rota, **uma rota não pode negociar o formato**: não existe
`output: format === 'csv' ? raw(...) : Schema`, e `raw()` também não é
parametrizável por um input. Ou seja, o padrão REST comum
`GET /coisa?format=json|csv` (e, na mesma linha, negociação por `Accept:`) não
tem como ser expresso honestamente — a única saída é declarar a rota como JSON e
devolver um `Response` de CSV, que é precisamente a mentira que a ADR-0024
existe para fechar (e que hoje vira erro de `tsc`, corretamente).

A resposta certa é duas rotas (`/organizer/export` e `/organizer/export.csv`), e
foi a que o plano adotou. Mas isso teve que ser **deduzido** de três trechos de
`.d.ts` em vez de lido: a guide apresenta `raw()` como "como devolver algo que
não é JSON" e nunca fecha a porta do `?format=`, que é a primeira forma que
alguém vindo de Express/Nest tenta.

Um segundo ponto, esse já documentado mas fácil de perder: com
`outputValidation` no default (`strict` fora de produção), o `raw()` faz
`response.clone().text()` do corpo. Para CSV finito é de graça; para stream é o
travamento que a kumite já reportou em
`v2/raw-output-infinite-stream-strict-hang.md` e que o
`back/src/modules/sse/sse.route.ts` contorna omitindo o 200 do `output`. Os dois
casos são o mesmo `raw()` com consequências opostas, e hoje quem lê a guide vê só
o feliz.

## Why it matters

É uma decisão de API que todo consumidor do kata toma uma vez por domínio que
exporta dado, e tomá-la errado só aparece no `tsc` (bom) ou, pior, num
`output` que mente (antes da ADR-0024). Uma frase na guide economizaria a
dedução: hoje ela custa ler `RawOutput`, `OutputSpec` e `RouteHandlerReturn` no
`.d.ts` bundleado para concluir algo que é consequência direta do desenho.

Vale o registro também do lado positivo, porque é o caso raro em que a doc
resolveu sozinha: o exemplo `/users.csv` mais a tabela de regras do
`guide/harness.md` responderam "o `kata verify` vai reclamar?" sem precisar
rodar nada — `kata/no-route-without-output-schema` é checagem de presença e
`raw(...)` conta, e a própria ADR-0024 diz que não ships regra nova obrigatória.

## Metrics

- Consultas: 1 rodada de leitura de `guide/routes-schemas.md`, `guide/harness.md`
  e ADR-0024 + confirmação no `.d.ts` bundleado, delegada a um subagente
  (~97k tokens, 19 chamadas de ferramenta, ~2 min). Pagou-se: era a única
  pergunta bloqueante do plano e voltou decisiva.
- `kata verify`: 0 execuções nesta fase (planejamento não toca código).
- Turnos perdidos por atrito de kata: 0 — a dedução foi trabalho legítimo, não
  retrabalho.

## Suggested fix

Na `guide/routes-schemas.md`, logo abaixo do exemplo `/users.csv`, duas linhas:

> `output` é fixo por rota, então uma mesma rota não pode alternar entre JSON e
> `raw()` em função de um `?format=` ou de um header `Accept`. Quando você
> precisa dos dois formatos, declare duas rotas (`/x` e `/x.csv`).

E, no mesmo bloco, um aviso cruzado de que em `strict` o corpo do `raw()` é
bufferizado via `clone().text()` — com link para o caso de stream infinito, que
hoje só existe como ADR/relato.
