# O módulo `greetings` do starter chega à produção público e sem teto de memória

**Found while**: kumite #188 — "Remover o módulo greetings do kata-starter, público e sem
limite de memória em produção" (planejamento). Achado #17 do diagnóstico de 2026-09-10.
**Where in kata**: `kata init` / `kata new` scaffold (`dist/chunk-535F5PJG.js`),
`kata verify` (`dist/src-UCVUEMQP.js`), `createApp` (`dist/index.js`), v0.4.2.

## What

O scaffold do `kata init` entrega um módulo `greetings` já **registrado** em `app.ts`,
com duas rotas **sem middleware de autenticação** e um `Map` de módulo que só cresce:

```ts
const greetings = new Map<string, Greeting>()   // greetings.service.ts
export function createGreeting(input) { greetings.set(id, greeting); return greeting }
```

`POST /greetings` aceita qualquer requisição anônima e adiciona uma entrada. Não há
despejo, TTL nem teto. Num app que subiu para produção sem ninguém apagar o exemplo, é
exaustão de heap com um `while true; do curl ...; done`.

Três observações que tornam isso mais do que "esqueceram de apagar o exemplo":

1. **O exemplo é *registrado*, não só gerado.** `kata new` faz o wiring no array `modules`
   do `app.ts` (`dist/new-IZ65QEZ3.js`), e o `init` já entrega greetings lá dentro. Apagar
   exige uma ação deliberada que nada no framework pede; não apagar não produz nenhum
   sinal.
2. **Nenhuma das 13 regras do `kata verify` consegue ver o problema.** As regras são todas
   sobre `.ts` de `src/` e sobre forma (schemas de input/output, DI/contexto, envelope de
   erro, nomes de arquivo, sem classe/decorator). Não existe regra sobre estado mutável de
   módulo, sobre rota pública, nem sobre "este arquivo ainda é o template". Rodei o censo
   de regras na fonte: `no-route-without-output-schema`, `no-route-without-input-schema`,
   `inline-schema`, `context-key-not-registered`, `scoped-slot-not-provided`,
   `scoped-read-outside-request`, `middleware-provides-mismatch`, `jwt-auth-provides-slot`,
   `no-adhoc-error-shape`, `no-raw-boundary-cast`, `schema-file-naming`, `no-decorator`,
   `no-class`. O módulo de exemplo passa limpo nas 13 — e passou, em todo commit do kumite
   desde o `init`.
3. **`--strict-coverage` não ajuda aqui.** Ele não muda quais regras rodam: só transforma
   *suppressions* (regra que não conseguiu provar a propriedade) em exit 1. Na prática só
   `scoped-slot-not-provided` emite suppression. Um app pode ter `kata verify
   --strict-coverage` verde em todo commit por meses com uma rota pública de exemplo
   acumulando memória.

## Why it matters

Todo consumidor de kata herda isso. O kumite carregou `POST /greetings` público por todo o
desenvolvimento — de `c4688da` até hoje — sem que nada no ferramental piscasse: `tsc`
limpo, `kata verify --strict-coverage` limpo, 658 testes verdes (inclusive os três testes
de `greetings.service` que o próprio scaffold gerou, atestando que o `Map` funciona). O
achado só apareceu num code-review humano de véspera de evento, e mesmo assim como
`[estático]`, sem reprodução.

O custo é assimétrico: o exemplo existe para durar uma tarde e o risco dura a vida do app.

## Outras duas coisas aprendidas na mesma leitura

- **404 de rota inexistente usa o envelope do kata, não o default do Hono.** `createApp`
  sempre instala `app.notFound(...)`; `buildNotFoundResponse` devolve
  `404 {"error":"not_found","message":"Route not found"}` em JSON com `x-request-id`.
  Caminho existente com método errado dá `405` + header `Allow`. Isso não está óbvio em
  lugar nenhum fora da fonte, e muda a asserção que um teste de remoção de rota escreve:
  dá para distinguir "a rota sumiu" de "o handler respondeu not_found" pela `message`.
- **`kata verify` nunca lê `.hurl` nem `.test.ts`.** O walker filtra
  (`isAnalysable`: descarta `.d.ts` e `.test.ts`, aceita só `.ts`), e a palavra "hurl"
  aparece no bundle só num comentário de `schema-file-naming`. Não existe regra de
  cobertura de hurl, nem regra que exija que uma pasta de módulo tenha
  route/service/schema/test/hurl — `schema-file-naming` é deny-list de nomes inesperados,
  nunca checa ausência. Um módulo com só `foo.route.ts` passa limpo.
- **Atrito menor, de graça:** `kata new` não consegue auto-wire no `app.ts` do kumite.
  `findModulesArray` exige literalmente `createApp({ modules: [ ... ] })`; o kumite usa
  shorthand (`export const modules = [...] as const` e depois `createApp({ modules, ... })`)
  para poder percorrer as rotas em `auth-guards.test.ts`. Isso é um
  `ShorthandPropertyAssignment`, não um `PropertyAssignment` com array literal, então o
  `kata new` cai no `status: "unrecognized"` e só imprime as linhas para colar. A forma que
  o kumite adotou por bons motivos derruba o auto-wiring.

## Metrics

- Consultas ao MCP `kata-docs`: **0** — está desabilitado em `.claude/settings.local.json`,
  e `~/Projetos/kata/docs` não existe nesta máquina.
- Fonte lida: o artefato publicado `@katajs-framework/core@0.4.2` (versão fixada pelo
  `pnpm-lock.yaml`), porque `node_modules` não está instalado no checkout principal.
  3 perguntas respondidas (envelope do 404, inventário de regras do verify + semântica do
  `--strict-coverage`, acoplamento ao array `modules`), todas por leitura de fonte.
- `kata verify` rodado no planejamento: **0** (pnpm não está no PATH desta sessão; a
  escada de gates é do passo de implementação).
- Turnos perdidos por atrito de kata: **~1** — descobrir que não havia nem docs locais nem
  `node_modules` e ter que ir ao tarball publicado.

## Suggested fix (sugestões, em ordem de custo)

1. **Regra `kata/starter-module-still-present`** (ou um aviso no `kata verify`): se
   `src/modules/greetings/` existe *e* está registrado em `app.ts`, avisar. Barato,
   determinístico, e some sozinho no dia em que o usuário apaga o exemplo.
2. **Gerar o exemplo desregistrado**, ou com um `// TODO: remova este módulo de exemplo
   antes de ir a produção` no topo do `.route.ts` e do `.service.ts`.
3. **Fazer o exemplo não ter estado sem teto**: um `Map` com tamanho máximo, ou um exemplo
   sem persistência nenhuma (eco puro). O valor didático do `Map` é baixo perto do risco —
   o comentário do próprio template já diz "swap it for a real one".
4. Aceitar `ShorthandPropertyAssignment` em `findModulesArray`, resolvendo o identificador
   para o `const` no mesmo arquivo, para o `kata new` voltar a auto-wire em apps que
   exportam o array.
