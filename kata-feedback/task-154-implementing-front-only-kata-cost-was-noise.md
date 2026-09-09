# #154 (implementing): tarefa 100% front — kata só apareceu como custo fixo no ladder

**Found while**: implementing #154 (wordmark do header vira link para a home)
**Where in kata**: `kata verify` (via o step `kata-verify` do pre-commit)

## What

Tarefa inteiramente de front: um `<span>` virou `<Link>`, três chaves de
i18n, testes de componente e uma spec Playwright. Nenhuma rota, schema,
middleware, DI, JWT ou hurl foi tocado — a superfície do kata não entrou em
jogo em momento nenhum.

Consequência prática: **zero consultas ao `kata-docs` MCP** neste passo, e
nenhuma decisão de implementação que dependesse de conhecer a API do kata.
O `kata verify` rodou mesmo assim (o pre-commit não distingue diff de front
de diff de back), e passou limpo nas duas execuções.

Observação secundária, não-kata mas relevante para quem lê métricas daqui:
a única fricção real do passo foi ambiental — o Postgres desta worktree
(porta 5445) não subiu de volta depois de um reboot da máquina, e a
primeira tentativa de commit gastou ~2 min rodando a suíte de back inteira
contra um banco inexistente antes de falhar com 100 testes vermelhos de
conexão. Nada disso é do kata; registro porque distorce qualquer leitura
ingênua de "tempo gasto no ladder".

## Why it matters

É o caso-base de que vale ter medida: quando o kata está fora do quadro, o
custo dele não é zero, mas é ruído. Ter isso registrado dá a linha de base
contra a qual as tarefas que *realmente* tocam kata podem ser comparadas —
sem ela, todo relatório do folder é de tarefa kata-pesada e a média fica
enviesada.

## Metrics

- **Consultas ao `kata-docs` MCP**: 0 (buscas e leituras de doc). Custo de
  contexto: 0 tokens. Não houve dead end porque não houve lookup — e nesta
  tarefa isso foi a decisão certa, não uma omissão.
- **`kata verify` no pre-commit**: 0,83 s, 61 arquivos, sem achados. Duas
  execuções (o commit falho pelo banco fora + o commit bem-sucedido).
- **Composição do ladder no commit verde** (141,08 s no total):
  format 0,70 s · typecheck 39,04 s · **kata-verify 0,83 s** · test 100,48 s.
  O kata responde por **0,6%** do tempo do gate; a suíte de back (que depende
  do Postgres, não do kata) responde por ~71%.
- **Turnos gastos por causa do kata**: 0. Turnos gastos por causa do
  Postgres caído pós-reboot: 4 (diagnóstico, `docker compose up -d`,
  `db:migrate`, re-commit) + ~2 min de ladder desperdiçado.

## Suggested fix (optional)

Nenhum para o kata. Se algum dia o `kata verify` deixar de ser barato, o
step do pre-commit ganharia com um filtro por caminho (`back/**`) — hoje,
com 0,83 s, isso seria otimizar ruído.
