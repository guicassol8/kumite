# Review da #216: kata fora do caminho, e `kata verify` foi o único sinal do `back/`

**Found while**: review do PR #249 (#216 — tokens da identidade, fontes no
bundle, alternância de tema, favicon e componentes de marca)
**Where in kata**: `kata verify --strict-coverage`; `kata-docs` MCP não foi
consultado uma vez

## What

Diff de 31 arquivos, **zero** deles em `back/`: CSS, SVG, `localStorage`,
Playwright e `package.json` do front. Nenhuma rota, schema, `.hurl`, DI, JWT ou
superfície de erro entrou em quadro — nem para ler.

Isso deixa o revisor numa posição específica: a única pergunta que sobra sobre o
`back/` é "isto continua íntegro?", e `kata verify --strict-coverage` respondeu
sozinho, em menos de 2 s, sem que eu precisasse abrir um arquivo do `back/`.
Rodou uma vez, 65 arquivos, limpo. O mesmo vale para a suíte: 601 testes de back
verdes confirmaram que nada vazou do front para lá.

Confirma a leitura do registro da fase de implementação
(`task-216-implementing-front-only-kata-passive-machine-oom.md`): numa task que
não toca o framework, o custo do kata é ~1 % da escada de portões e o
benefício é justamente esse — um "nada mudou aqui" barato e confiável.

## Why it matters

É a linha de base do **custo passivo** do kata numa task front-only, medida
agora do lado do review e não só do lado de quem implementa. Um verificador que
custa 2 s e responde a pergunta inteira do revisor sobre um pacote intocado é o
comportamento desejado: dá para deixá-lo cedo na escada, antes do vitest, e
tratar a saída como sinal suficiente.

Nenhuma consulta ao `kata-docs` foi necessária, e isso também é informação:
quando o plano aprovado delimita a task como front-only, o MCP não é chamado
nem por engano — o overhead de tê-lo conectado foi zero.

## Metrics

- Consultas ao `kata-docs` MCP neste review: **0**. Custo de contexto: **0 tokens**.
  Nenhuma pergunta sobre a API do kata surgiu em nenhum dos dois estágios.
- `kata verify --strict-coverage`: 1 execução, 65 arquivos, `no problems found`.
- `pnpm -r test`: blocks 51 · back 601 (66,6 s) · front 543 — todos verdes.
- Fatia do kata no tempo total de verificação do review (typecheck + verify +
  testes + e2e + build ≈ 3 min): **~1 %**.
- Turnos perdidos para atrito de kata: **0**.

## Observação de ambiente (não é kata)

`docker compose up -d` na worktree de review falhou com `all predefined address
pools have been fully subnetted` — o mesmo esgotamento de pool que
`task-228-review-docs-only-kata-out-of-frame-docker-network-pool-exhausted.md`
já descreve em detalhe; não repito aqui. Registro só a **segunda ocorrência**,
para dizer que não foi episódio isolado, e o contorno que usei: `docker run
--network bridge -p 5463:5432 postgres:17-alpine`, que sobe um Postgres avulso
sem criar rede nova — útil quando `docker network prune` não está disponível
por ser ação sobre recurso compartilhado.
