# `kata/schema-file-naming` never sees `.test.ts` or `.hurl` — two of the five suffixes it advertises are unenforced

**Found while**: review do PR #158 / issue #98 — a errata do ADR-0001 do kumite
cita essa regra como a que trava o layout de `src/modules/<domain>/`, então o
review foi conferir se a regra realmente faz o que a errata diz.
**Where in kata**: `packages/verify/src/rules/schema-file-naming.ts`, mais o
fs-walk que alimenta `project.files`.

## What

A regra **funciona** para o caso que a errata do kumite descreve: um
`sandbox-engine.worker.ts` dentro de `src/modules/judge/` é pego, com mensagem
e `fix` excelentes. Isso foi verificado plantando o arquivo de verdade.

Mas a mensagem de erro anuncia cinco sufixos legais —
`<domain>.{route,service,schema,test}.ts` ou `<domain>.hurl` — enquanto
`allowedNames` só contém três. O próprio código comenta o porquê:

```ts
const allowedNames = [
  `${domain}.route.ts`,
  `${domain}.service.ts`,
  `${domain}.schema.ts`,
  // Note: fs-walk excludes .test.ts and .d.ts, and .hurl is not a .ts
  // file, so <domain>.test.ts and <domain>.hurl never reach this rule —
  // but they are legal module files, so the message below lists them.
]
```

O comentário está certo sobre *por que* eles não chegam, mas a consequência
não é só "não precisam ser checados" — é que **um `.test.ts` ou `.hurl` com
nome errado dentro da pasta do módulo não é pego por ninguém**. Verificado
empiricamente no kumite (61 arquivos, `--strict-coverage`):

```console
$ printf 'GET http://localhost:3000/health\nHTTP 200\n' > back/src/modules/judge/totally-wrong-name.hurl
$ printf 'export const x = 1\n' > back/src/modules/judge/some-helper.test.ts
$ pnpm verify
✓ kata verify: no problems found (61 files checked)
```

Os dois arquivos são ilegais pela própria definição que a regra imprime, e
passam limpos. A contagem continua em 61 — eles nunca entram em
`project.files`, então não é a regra que os aceita: é o walker que os esconde.

## Why it matters

O buraco é estreito mas fica exatamente onde dói: `.test.ts` e `.hurl` são os
dois sufixos que um agente mais provavelmente cria com nome improvisado
(`helpers.test.ts`, `smoke.hurl`, `auth-flow.hurl`), justamente porque são os
arquivos "de apoio" do módulo. O agente roda `kata verify`, vê verde, e conclui
que o layout está certo — a mesma classe de erro que a issue #98 do kumite
existe para consertar, só que dessa vez sem nada que o corrija depois.

Vale registrar o contraste: `kata verify` é o **único** mecanismo que falsifica
uma afirmação de layout. Documentação em prosa nunca é verificada — foi por
isso que o ADR-0001 do kumite descreveu um layout impossível por ~2 semanas.
Quanto mais a regra cobre, menos prosa errada sobrevive.

## Metrics

- **Lookups no kata-docs MCP neste review: zero.** A regra foi lida direto da
  fonte (`packages/verify/src/rules/schema-file-naming.ts`) — 1 turn, ~50
  linhas. Para "essa regra faz mesmo o que a doc diz?", ler a fonte foi
  estritamente melhor que perguntar à doc: a resposta estava num comentário
  de código que nenhuma doc reproduz.
- **Custo de provar em vez de acreditar: ~3 turns e ~4s de `kata verify`**
  (1.3s por execução, 61 arquivos) para plantar arquivo ilegal → rodar →
  remover. Barato o bastante para virar hábito em review de PR que *afirma*
  algo sobre uma regra do kata.
- **Falso alarme descartado**: `pnpm verify` imprime uma linha `undefined`
  solta entre a saída do kata e o erro do pnpm quando a regra falha. Rodando
  `npx kata verify` direto, ela não aparece — é artefato do wrapper recursivo
  do pnpm, **não** do kata. Registrado só para o próximo agente não abrir bug
  no kata por causa disso.

## Suggested fix (optional)

Duas opções, em ordem de preferência:

1. Fazer o fs-walk incluir `.test.ts` e `.hurl` em `project.files` (mantendo-os
   fora das regras que só olham código de produção) e deixar `allowedNames`
   listar os cinco de verdade. Assim a mensagem que a regra já imprime passa a
   ser verdade.
2. Se mudar o walker for invasivo demais: uma checagem própria e barata que
   liste `src/modules/<domain>/` no disco e valide os nomes ali, sem depender
   de `project.files`.

Em qualquer um dos casos, vale um caso de teste em
`schema-file-naming.test.ts` com um `<outro-nome>.hurl` — hoje não existe, o
que é coerente com o fato de a regra nunca ter recebido um.
