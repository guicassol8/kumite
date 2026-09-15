# hurl não tem teardown: "limpa no último passo" só funciona na suíte verde

**Found while**: planejamento da #161 (db:seed não reseta `event_config` e a
suíte hurl fica acoplada à ordem do glob)
**Where in kata**: hurl como gate de E2E (`kata`'s hurl surface / o script
`hurl --test --jobs 1 src/modules/*/*.hurl` que o kumite herdou)

## What

Observação, não bug do kata. O padrão que a suíte de `.hurl` do kumite adotou —
mutar estado event-wide no meio do arquivo e restaurar no **último** passo —
tem uma falha estrutural: hurl não oferece nada equivalente a um
`afterAll`/`finally`. Quando um assert intermediário falha, o arquivo aborta e
os passos de restauração nunca rodam. O resultado é o inverso do desejado: a
suíte verde é o único caso em que a limpeza acontece; a suíte vermelha propaga
estado sujo para todo arquivo que ordena depois no glob.

No caso concreto, `event-config.hurl` (3º no glob) deixa `event_config` fora do
default quando quebra, e `teams.hurl` (13º) falha com asserts que não têm
relação nenhuma com a mudança em revisão. Já custou tempo real no review do
#159.

O plano da #161 resolve isso do lado do kumite invertendo a responsabilidade —
cada arquivo **arranja** seu próprio estado event-wide no bloco 0 em vez de
confiar na limpeza de quem veio antes. Vale registrar porque é uma armadilha
que qualquer consumidor de kata com hurl + banco compartilhado vai encontrar, e
a documentação de hurl no kata não avisa.

Segunda observação, menor: `--jobs 1` deixa a execução sequencial e
determinística, mas a ordem é a do glob (alfabética por módulo), o que faz o
acoplamento depender de um detalhe acidental de nomenclatura de pasta. Um
arquivo renomeado pode mudar quem herda o quê.

## Why it matters

Qualquer app kata que use hurl contra um Postgres compartilhado herda o mesmo
padrão. O sintoma (assert falhando num módulo que o PR não toca) é caro de
diagnosticar porque parece regressão e não é.

## Metrics

- Consultas ao `kata-docs` MCP neste planejamento: **zero**. O problema é 100%
  estado de aplicação (seed + ordem dos arquivos), nenhuma pergunta sobre API,
  DI, middleware ou envelope de erro do kata apareceu. Nenhum custo de lookup,
  e nenhum ganho perdido por não fazer — a resposta estava toda no código do
  kumite.
- Custo do planejamento: ~10 leituras de arquivo (seed, schema, service, dois
  `.hurl`, config do vitest, CI), 2 rodadas de perguntas ao usuário, nenhuma
  execução de app ou de banco.
- Fricção de harness registrada: nenhuma nesta sessão.

## Suggested fix (optional)

Nada obrigatório para o kata. Se a documentação de hurl do kata quiser cobrir
isso, a regra que o kumite vai adotar cabe em uma linha: *arranje seu próprio
estado global no início do arquivo; não trate o último passo como teardown.*
