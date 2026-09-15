# Implementação da #226: task 100% GitHub — kata fora de quadro, e a gate ladder corretamente silenciosa

**Found while**: implementing-tasks #226 (sanear os corpos das issues do epic #214)
**Where in kata**: nenhum módulo tocado; nenhum comando do kata executado

## What

A #226 foi executada até o fim sem editar um único arquivo rastreado do repo:
13 corpos de issue reescritos via `PATCH /repos/:o/:r/issues/:n`, 2 issues
criadas, 1 título alterado, 1 comentário de evidência. `git status` fecha a
sessão com zero diff em `back/`, `front/` e `blocks/`.

Consequências para o quadro do kata, em ordem de utilidade:

1. **Nada do kata entrou em quadro** — sem rota nova, sem schema, sem DI, sem
   hurl. `kata verify` não rodou porque não havia o que verificar, e isso está
   certo: é o comportamento novo do Stop hook (commit `551b443`, gate ladder só
   com mudança de código pendente) funcionando como anunciado. A sessão anterior
   (#226 planning) tinha deixado essa observação pendurada; esta confirma na
   prática, agora com uma task que vai até o fim em vez de só planejar.
2. **O contrato de dados de novo se resolveu no zod, não na kata-docs.** A
   implementação precisou *reconfirmar* três afirmações antes de escrevê-las em
   issue: `position` em `ParticipantRoundProblemSchema`
   (`rounds.schema.ts:131-141`), `RoundRefSchema` = `{id, closesAt}`
   (`sse.schema.ts:8-11`), e a inexistência de `position` no payload de
   `/problems/:id`. Três greps. Zero kata-docs. Igual ao planejamento — o padrão
   se sustenta em duas sessões seguidas da mesma task.
3. **Verificar antes de escrever pegou um erro do plano aprovado.** O plano
   mandava listar "as duas únicas chamadas afetadas" pela redefinição da variante
   `destructive` do botão. Um `grep -rn 'variant="destructive"' front/src` devolve
   ~20 ocorrências; só depois de filtrar por `<Button` (contra `<Alert`) o número
   volta a ser 2. O plano estava certo, mas por pouco — e a issue #226 existe
   justamente porque alguém escreveu superfície incompleta num enunciado. Isso não
   é sobre o kata; é sobre o fato de que **a checagem barata (`grep -B4 ... | grep
   -c '<Button'`) é o que separa "o plano disse" de "o repo confirma"**.

## Why it matters

Quarto registro seguido de "kata fora de quadro" no epic de design (#215 review,
#226 planning, #226 implementing). A conclusão já não é sobre esta task: **o epic
#214 inteiro é front + docs, e nenhuma de suas sub-issues, exceto a #231
(`stack:back`, e-mail de redefinição), deve gerar sinal sobre o kata.** Vale
calibrar a expectativa: se as próximas 8 sessões do epic também vierem "fora de
quadro", isso não é ausência de sinal — é o sinal, e o custo de abrir o arquivo
para dizê-lo é ~1 minuto por sessão. A #231 é onde o kata volta a importar
(SES, template de e-mail, locale do usuário).

Um ponto que é do harness e não do kata, mas afeta quem trabalha aqui: a
`api.github.com` deu `i/o timeout` intermitente a sessão toda, e `gh issue edit`
(GraphQL) falhou mais que `gh api -X PATCH` (REST). Um wrapper de retry de 6
linhas resolveu; sem ele, uma task de 15 escritas remotas fica não-determinística.
Nada a fazer no kata — registrado porque a próxima task pesada em `gh` vai bater
no mesmo muro.

## Metrics

- Consultas à kata-docs MCP: **0**. Docs do kata lidos: **0**.
- Comandos do kata executados: **0** (`kata verify` não rodou — nenhum diff em `back/`).
- Gate ladder: não executada, corretamente (zero mudança de código). Custo de
  Postgres/vitest nesta sessão: **0** — contra os ~2-4 min que a ladder custava
  antes do `551b443` em sessões sem código.
- Leituras de `back/src`: 3 greps/seds (`rounds.schema.ts`, `sse.schema.ts`),
  todos para confirmar contrato antes de citá-lo numa issue. < 2k tokens.
- Fricção atribuível ao kata: **nenhuma**. Fricção atribuível à rede/GitHub:
  ~8 chamadas `gh` falharam com `i/o timeout` e foram recuperadas por retry.

## Suggested fix (optional)

Nenhum para o kata. Para o kumite, se o padrão incomodar: as skills poderiam
dizer "task sem `back/` → registre 'fora de quadro' em uma linha e siga", em vez
de pedir um relatório completo — mas o custo atual é baixo o bastante para não
valer mudar a regra.
