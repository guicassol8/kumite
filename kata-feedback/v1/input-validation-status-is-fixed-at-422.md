# O status do envelope de validação de input é fixo em 422 — não há como uma rota pedir 400

**Found while**: planning-tasks da issue #11 (endpoint de leitura de problema do
participante, `GET /problems/:id?locale=<pt|es|en>`)
**Where in kata**: `defineRoute` → validação de `input` (`params`/`query`/`body`/
`headers`), documentada em `reference/define-route.md` § *Input — before the
handler* e `guide/errors.md` § *The 422 validation envelope* / ADR-0003, ADR-0008

## What

A Acceptance escrita pelo usuário na #11 dizia, em EARS: "WHEN um locale não
suportado é pedido THE SYSTEM SHALL responder **400** indicando os locales
válidos". O desenho natural no kata é `input: { query: z.object({ locale:
LocaleSchema.default('pt') }) }` — mas aí quem responde é o kata, antes do
handler, e o envelope tem status **fixo em 422**. Não achei (nem na doc nem
por busca) nenhum hook para uma rota dizer "para *este* schema de input, o
status é 400": o 422 é parte do contrato, e a única saída é abrir mão da
validação declarativa — declarar `locale: z.string()`, deixar entrar qualquer
coisa e revalidar à mão no handler para poder chamar
`c.error('unsupported_locale', …, { status: 400 })`.

Não estou reclamando do 422 em si (é o status certo, e a rigidez é
deliberada — ADR-0003/0008 dizem isso com todas as letras). O que registro é
que a rigidez tem um custo de negociação a montante: uma spec escrita antes de
conhecer o kata, ou herdada de outro serviço/cliente, vira uma escolha entre
"reescreve a spec" e "escreve o handler contra o grão do framework". Aqui deu
certo — mostrei o trade-off ao usuário e ele escolheu ajustar a Acceptance para
422 —, mas em um contrato de API já publicado, ou com um cliente móvel que só
trata 4xx específicos, a mesma decisão não seria de graça.

Vale registrar o que **funcionou bem**: a mensagem do zod que sai em
`issues.query[0].message` (`Invalid enum value. Expected 'pt' | 'es' | 'en',
received 'de'`) já satisfaz a metade substantiva da Acceptance — "indicando os
locales válidos" — sem uma linha de código. Só o número do status divergia. Um
exemplo de query com `z.enum` no `guide/errors.md`, mostrando exatamente esse
payload de `issues.query`, teria encurtado a conversa: eu tive que deduzir o
texto da mensagem a partir do exemplo de `body` da doc.

## Why it matters

Todo consumidor do kata que chega com uma spec pronta (ou com um front já
escrito) vai bater nisso na primeira rota com query param enumerado — e é o
tipo de descoberta que se faz tarde, na implementação, e não no planejamento,
se ninguém tiver perguntado. Duas coisas baratas ajudariam:

1. Uma frase explícita em `reference/define-route.md` § *Input* dizendo que o
   status **não é configurável** e qual é a saída quando o contrato exige
   outro (validar à mão no handler), para o agente não gastar turnos
   procurando a opção que não existe.
2. O exemplo de envelope 422 da doc usa só `issues.body`. Um segundo exemplo
   com `issues.query` e um `invalid_enum_value` cobriria o caso mais comum de
   query param e daria a mensagem literal para escrever a asserção do `.hurl`
   sem chutar.

## Metrics

- **kata-docs nesta sessão de planejamento**: 2 `search_docs` + 2 `read_doc`
  (`guide/routes-schemas.md` § *Optional query filters: the `z.coerce.boolean()`
  trap* e `reference/define-route.md` § *Input — before the handler*), mais 1
  `search_docs` de checagem sobre regras do `kata verify`. ~5 round-trips de MCP
  num planejamento de ~30 chamadas de ferramenta no total.
- **Pagou-se?** Sim, e com folga. As duas leituras responderam de primeira e
  mudaram o plano de forma material: sem elas eu teria escrito a rota com
  `output: { 400: ErrorBodySchema }` acreditando que o kata deixava customizar,
  e a divergência só apareceria no `.hurl` — depois do plano aprovado, depois do
  código escrito. O custo de contexto (~4k tokens de doc lida) é menor que um
  ciclo de replanejamento.
- **Bônus não pedido**: a seção do `z.coerce.boolean()` veio junto na busca por
  "query input schema validation". Não uso booleano nesta rota, mas é
  exatamente a armadilha que eu teria caído na próxima rota de listagem com
  filtro. Doc que ensina o footgun antes de você chegar nele é o melhor sinal
  que esse índice deu até agora.

## Suggested fix

Nas duas frases do § *Why it matters* acima — ambas são edição de doc, nenhuma
mudança de comportamento. O 422 fixo está certo; só precisa estar dito.
