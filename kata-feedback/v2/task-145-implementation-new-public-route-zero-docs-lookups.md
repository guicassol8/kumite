# Um módulo público novo do zero, com zero consultas ao kata-docs

**Found while**: #145 — implementação (rota pública `POST /bug-reports` + e-mail via SES)
**Where in kata**: `defineRoute` (`input`/`output`/`c.error`), `kata verify --strict-coverage`, hurl

## What

Primeiro módulo inteiramente novo criado nesta sessão (route + schema +
service + test + hurl), e a superfície do kata foi resolvida sem uma única
consulta ao `kata-docs` MCP — não porque o servidor estivesse fora (não
tentei), mas porque copiar `password-reset.route.ts` respondeu tudo:

- rota pública = simplesmente omitir `use:`;
- status fora do feliz declarado em `output` com `ErrorBodySchema`;
- `c.error(code, message, { status })` para 429 e 502.

Duas observações que valem registro, ambas já conhecidas do folder:

1. **422 não é declarável.** A validação do kata responde antes do handler,
   então `422` não entra em `output` — e, no front, `res.status === 422` não
   compila (TS2367, "no overlap"), obrigando o cast `(res.status as number)`.
   Já reportado antes (`kumite-kata-422-untyped-in-hc-client`); a diferença
   aqui é que a rota é nova, então o atrito apareceu de novo no primeiro
   contato, não como legado.
2. **Sem `Retry-After` no 429.** O cooldown é por IP e sabe exatamente quanto
   falta, mas `c.error` não deixa setar header (registrado em
   `c-json-has-no-headers-either...`), então o front mostra um texto fixo
   "aguarde um minuto" em vez do tempo real. Funciona, mas é informação que
   o servidor tem e não consegue entregar.

`kata verify --strict-coverage` passou limpo em todas as rodadas (65 arquivos)
e não apontou nada no módulo novo — nem falso positivo nem achado real. O hook
PostToolUse rodou junto de cada edição sem ruído.

## Why it matters

O caminho "copiar o módulo vizinho" funciona bem o suficiente para que
consultar a documentação não se pague — o que é um elogio à consistência do
framework e, ao mesmo tempo, o motivo de o `kata-docs` MCP não ter sido
exercitado. Já os dois pontos acima são limites reais da superfície de erro:
o 422 invisível ao cliente tipado e o 429 sem `Retry-After` custam,
respectivamente, um cast e uma mensagem menos precisa em toda rota pública
nova.

## Metrics

- Consultas ao `kata-docs` MCP nesta implementação: **0** (0 tokens).
- Tempo/turnos perdidos com kata: **0**. Nenhum dead end de doc, nenhum
  falso positivo do `verify`.
- `kata verify --strict-coverage`: ~0,8s por execução, rodado ~6 vezes
  (hook + gates manuais). Custo desprezível.
- Comparativo honesto: adivinhar a partir do módulo vizinho custou menos que
  qualquer round-trip de documentação teria custado. O gargalo da task foi
  o front (Radix + react-hook-form + jsdom), não o kata.

## Suggested fix (optional)

Nada novo. Os dois itens já têm relato próprio no folder; este entra como
confirmação de que continuam aparecendo em código novo, não só no legado.
