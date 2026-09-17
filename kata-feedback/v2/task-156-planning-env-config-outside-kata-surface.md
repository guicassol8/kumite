# Env config vive fora da superfície do kata — planejamento com zero lookups

**Found while**: planejando #156 (documentar env de produção; virou também um
rename `AWS_*` → `SES_*` em `back/src/config.ts`).

**Where in kata**: nenhum. É exatamente essa a observação.

## What

Observação simples, sem bug. A #156 mexe em `back/src/config.ts`, num
`*.service.ts` de módulo e em dois `*.test.ts` — código que mora dentro da
árvore de um app kata — e mesmo assim o `kata-docs` MCP não foi consultado
nenhuma vez, sem que nada no plano ficasse por adivinhação.

A razão é estrutural: a configuração por ambiente do kumite não passa por
nenhuma superfície do kata. `config.ts` é um `z.object(...).parse(process.env)`
solto no topo do pacote, exportando constantes; `notifications.service.ts` as
importa direto. Não há token de DI, provider, nem hook de bootstrap do kata no
caminho — então renomear três variáveis de ambiente é uma operação puramente
de TypeScript, resolvida por `tsc` e pelos testes existentes. Os únicos
artefatos kata perto da mudança (`defineRoute` em
`password-reset.route.ts`, o `.hurl` do módulo) não são afetados justamente
porque o comportamento observável não muda.

Vale registrar o outro lado: o bug que motivou a expansão de escopo — o
`back/.env` real usar `SES_REGION` enquanto o código lia `AWS_REGION`, fazendo
o envio de e-mail cair silenciosamente num `console.log` — também é invisível
para qualquer ferramenta do kata. `kata verify` passa, os testes passam, a
rota responde 204 por design (ADR-0003), e nada em lugar nenhum observa que
uma variável documentada nunca é lida no ambiente real. Não é uma crítica ao
kata (é um app que optou por não modelar config via framework), mas é o tipo
de lacuna que um dia poderia justificar uma superfície de config declarada —
onde "var esperada X não está presente" fosse uma pergunta que o framework
consegue responder.

## Why it matters

Reforça o padrão que as últimas entradas vêm medindo: o valor do kata-docs
neste repo está concentrado no *primeiro* encontro com cada superfície. Tasks
que mexem em código que fica *ao lado* das superfícies kata — config, libs,
schemas zod puros — não geram lookup nenhum, e provavelmente nunca vão gerar.
Útil para quem esteja pesando onde investir esforço de documentação.

## Metrics

- Consultas ao kata-docs MCP: **0**. Docs lidos: **0**.
- Custo do planejamento: ~10 chamadas de ferramenta, todas `cat`/`grep` sobre
  a própria fonte do kumite, mais 4 rodadas de AskUserQuestion (17 perguntas).
- Turnos perdidos em beco sem saída de doc: 0.
- `kata verify` não foi rodado (planejamento não escreve código).
- Custo de não consultar: nenhum visível. Como sempre, é autorrelato — uma
  suposição errada só apareceria na implementação.

## Suggested fix

Nenhum. Registro como sinal.
