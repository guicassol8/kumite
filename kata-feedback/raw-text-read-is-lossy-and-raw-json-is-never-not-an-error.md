# Ler uma rota `raw()` pelo `hc<AppType>`: `.text()` perde bytes e `.json()` é `never`, não erro

**Found while**: implementação da kumite #278 (export do evento em JSON e CSV),
a task planejada em `raw-output-is-static-per-route-so-format-query-is-inexpressible.md`.
**Where in kata**: `raw()` / `MapEntryEndpoint` / `OutputEndpoints`
(`dist/context-*.d.ts:197,206`), `guide/routes-schemas.md`
§ *Non-JSON responses: `raw()`*, ADR-0024.

## What

Duas medições do lado **consumidor** do `raw()`, que é o lado que a guide não
mostra: ela ensina a declarar a rota, nunca a lê-la pelo cliente tipado.

### 1. `.text()` é o caminho natural e é lossy

`MapEntryEndpoint` mapeia um `RawOutput` para `HonoEndpoint<…, 'text'>`, e o
efeito prático é que `res.text()` fica com o tipo exato `string` e `res.json()`
some do caminho feliz. Então todo mundo lê com `.text()` — foi o que o plano
desta task escreveu e o que eu implementei.

Só que `Response.text()` roda o *UTF-8 decode* do Encoding Standard, que
**remove um BOM inicial**. Para um CSV que existe justamente para abrir no Excel
em pt-BR, o BOM não é decoração: sem ele o Excel lê "Mérida" como "MÃ©rida". O
back servia `ef bb bf` (conferido byte a byte no fio com `xxd`), o front lia com
`.text()`, e o arquivo salvo começava em `70 6f 73` — o byte sumia na fronteira,
com `tsc`, `kata verify`, 15 arquivos hurl e todos os testes de unidade verdes.
Quem pegou foi um e2e que afirmava sobre os bytes do arquivo baixado.

A correção é ler `.blob()`, que o `ClientResponse` herda de `Response` e que
continua tipado (`Promise<Blob>`) — mas é uma saída que só se acha depois de
saber do problema, porque o tipo empurra para `.text()`.

O ponto para o kata: **`raw()` existe para payloads que não são JSON, e a
principal razão de não ser JSON costuma ser "os bytes importam"**. O caminho de
leitura que a tipagem privilegia é exatamente o que não preserva bytes. Um
`raw()` com `z.string()` promete uma string; um `raw()` de PNG ou PDF não tem
nem isso, e `.text()` seria destrutivo de forma muito mais óbvia.

### 2. `.json()` numa rota `raw()` é `never`, não erro de compilação

O plano desta task afirmava que `res.json()` numa rota `raw()` vira erro de
compilação. Medido com um `Equals<A, B>` de tipo, não é:

```ts
const csv = await api.organizer['export.csv'].$get({ query: { kind: 'ranking' } })
const textIsString: Equals<Awaited<ReturnType<typeof csv.text>>, string> = true   // ✅
const jsonIsNever:  Equals<Awaited<ReturnType<typeof csv.json>>, never>  = true   // ✅
```

`SuccessOutput<O>` devolve `never` quando a entrada 200 é um `RawOutput`
(`:445`), e `never` é atribuível a qualquer coisa. Logo
`const body: string = await res.json()` **compila em silêncio** e explode em
runtime com `SyntaxError: Unexpected token 'p'`. A intenção do desenho está
certa e o `never` é o tipo honesto; o que falta é a chamada errada ser
*rejeitada* em vez de apenas se tornar inútil. Um overload que tipasse `json()`
como `(this: void) => never` com `@deprecated`, ou um `never` nominal
(`{ __kataRawBody: 'use text() or blob()' }`), transformaria o erro de runtime
em erro de `tsc`.

## Why it matters

Os dois pontos se somam num caminho de menor resistência que erra calado: o tipo
proíbe visivelmente nada, sugere `.text()`, e `.text()` corrompe silenciosamente
o único tipo de payload para o qual `raw()` existe. Nenhum gate do kata pega —
e não deveria mesmo, é a fronteira HTTP — mas uma nota na guide pegaria.

Do lado positivo, e vale registrar: `raw()` atravessou o resto do contrato sem
nenhum atrito. `kata verify --strict-coverage` passou verde em todas as
execuções com a rota nova (`raw(...)` satisfaz
`kata/no-route-without-output-schema`, como a ADR-0024 promete), a validação
`strict` do corpo rodou de graça num CSV finito, e o `?kind=` fechado por enum
deu 422 com envelope `validation_failed` nos três casos (valor desconhecido,
vazio e ausente) sem uma linha de código a mais.

## Metrics

- Consultas às docs: 1, e só ao `.d.ts` bundleado (`grep` por `raw`/`RawOutput`
  em `dist/context-*.d.ts`) — o relatório do planejamento já trazia as respostas
  de `guide/routes-schemas.md` e da ADR-0024, então a fase de implementação não
  precisou voltar às docs. Pagou-se: confirmou `raw` como export de
  `@katajs-framework/core` antes de escrever a rota.
- `kata verify`: 6 execuções (2 explícitas + 4 nos pre-commits), 66–67 arquivos,
  **0 achados** em todas.
- hurl: 8.0.1. 15 arquivos, 346 requisições, verdes, incluindo os 14 pedidos do
  `export.hurl` novo.
- Turnos perdidos por atrito de kata: 0. O defeito do BOM custou ~3 turnos, mas
  não é atrito de kata: é uma consequência da Fetch API que o desenho do `raw()`
  apenas deixa de sinalizar.

## Suggested fix

Na `guide/routes-schemas.md`, no bloco do `raw()`, depois do `/users.csv`:

> No cliente, leia uma rota `raw()` com `res.text()` **apenas quando o corpo for
> texto e os bytes não importarem**: `Response.text()` faz UTF-8 decode e
> descarta um BOM inicial. Para preservar o corpo byte a byte (um CSV com BOM
> para o Excel, um PDF, uma imagem), use `res.blob()` ou `res.arrayBuffer()`.
> `res.json()` nessas rotas é tipado `never` — compila, mas falha em runtime.

E, se valer a pena no runtime: marcar `json()` como `@deprecated` no
`HonoEndpoint` de formato `'text'`, para que o editor avise antes do `tsc` não
avisar.
