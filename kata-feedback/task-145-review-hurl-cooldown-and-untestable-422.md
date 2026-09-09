# Revisão da #145: hurl não é re-executável quando a rota tem estado in-memory, e o 422 continua invisível

**Found while**: #145 — review do PR #167 (rota pública `POST /bug-reports`)
**Where in kata**: hurl runner (`kata`'s hurl integration), superfície de validação/`output`

## What

Review de um módulo novo inteiro (route + schema + service + test + hurl).
Zero consultas ao `kata-docs` MCP — não tentei o servidor; ler o diff e os
módulos vizinhos respondeu tudo. Três observações:

1. **O hurl não tem como resetar estado de processo.** A rota tem um cooldown
   por IP in-memory de 60s. O arquivo `bug-reports.hurl` faz um 200 e logo em
   seguida um 429 — correto e valioso — mas com isso **o arquivo deixa de ser
   re-executável contra um servidor quente**: rodar de novo dentro da janela
   faz o caso do 200 responder 429. O autor documentou isso num comentário
   grande no topo do arquivo, que é a única mitigação disponível hoje.

   Não existe no hurl do kata um gancho de setup/teardown por arquivo (já
   registrado em `task-161-planning-hurl-has-no-teardown...`) nem uma forma de
   pedir ao servidor que zere um seam de teste. O módulo até exporta
   `resetBugReportThrottle()` para o vitest, mas o hurl não alcança.

2. **`--variable` é global, não por arquivo.** Para cobrir "descrição acima do
   teto de 2000 caracteres" (que a Acceptance pedia e faltava), a opção limpa
   seria `{{too_long}}`, mas as variáveis vivem no script `hurl` do
   `package.json`, compartilhado por todos os 15 arquivos. Acrescentar uma
   variável que só um arquivo usa polui a linha de comando de todos, então
   acabei inlinando um literal de 2001 caracteres. Funciona, mas é uma linha
   ilegível num arquivo que no resto é bem legível.

3. **O 422 invisível apareceu de novo, agora no e2e.** Já registrado duas
   vezes (`kumite-kata-422-untyped-in-hc-client` e a entrada de implementação
   desta mesma task). Menciono só porque o custo se repetiu numa terceira
   camada: o front precisa do cast `(res.status as number) === 422`, e quem lê
   o componente encontra um comentário de quatro linhas explicando por quê.

`kata verify --strict-coverage` passou limpo (65 arquivos) em todas as
execuções do review, incluindo depois das minhas duas correções. Nada de falso
positivo. Os 15 arquivos hurl rodaram em ~6,7s, 301 requisições.

## Why it matters

O ponto 1 é o que mais custa: **rotas com estado de processo (cooldown, quota,
cache) são exatamente as que mais precisam de e2e de API, e são as que o hurl
menos consegue testar de forma repetível.** A saída de hoje é escrever no
comentário "reinicie o servidor antes de rodar de novo" — o que funciona no CI
(servidor sempre novo) e falha na mão de quem está desenvolvendo local, que é
justamente quem roda a suíte duas vezes seguidas.

O ponto 2 é menor, mas empurra autores para literais gigantes inline sempre
que um caso precisa de um payload grande — e payload grande é o formato
natural de todo teste de limite de tamanho.

## Metrics

- Consultas ao `kata-docs` MCP neste review: **0** (0 tokens). Não tentei o
  servidor; o diff mais os módulos vizinhos bastaram.
- Turnos perdidos com kata: **0**. Nenhum dead end, nenhum falso positivo.
- `kata verify --strict-coverage`: ~0,75s por execução, ~5 execuções.
- Suíte hurl completa: ~6,7s para 15 arquivos / 301 requisições.
- Custo real do review ficou em infra do kumite (Postgres da worktree caiu no
  meio, e um teste order-dependent pré-existente do #154 barrou o pre-commit
  duas vezes), não em kata.

## Suggested fix (optional)

Para o ponto 1, qualquer um dos dois resolveria:

- um bloco de setup/teardown por arquivo hurl (mesmo pedido de
  `task-161-planning-hurl-has-no-teardown...`), permitindo chamar uma rota de
  reset antes do arquivo; ou
- reconhecer que isso é responsabilidade do consumidor e documentar o padrão
  "seam de reset exposto só em `NODE_ENV=test`" como receita oficial do kata,
  já que hoje cada módulo inventa o seu.

Para o ponto 2, aceitar `--variables-file` por diretório de módulo, ou permitir
que o próprio arquivo `.hurl` declare variáveis locais.
