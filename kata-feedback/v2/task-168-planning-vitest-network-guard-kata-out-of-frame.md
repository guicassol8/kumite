# Uma guarda de rede no vitest do front nunca cruzou com o kata

**Found while**: planejamento do #168 (`header.test.tsx` roda sem stub de API e
depende da ordem: 401 real derruba a sessão e desvia o router).

**Where in kata**: nenhum ponto de contato — nem `kata-docs` MCP, nem
`kata verify`, nem hurl, nem DI/JWT/erros. A task inteira vive em `front/`.

## What

Observação, sem bug. O plano saiu inteiro de leitura local (`vitest.config.ts`,
os cinco `src/test/*-jsdom.ts`, `header.test.tsx`, `api.ts`, `sse-client.ts`,
`__root.tsx`) e de uma sondagem executável num worktree descartável. Zero
consultas ao `kata-docs`.

Vale registrar o método, porque foi ele que pagou: em vez de planejar a partir
da Spec da issue, escrevi a **guarda como sonda** primeiro — um `setupFile` que
troca `globalThis.fetch` por algo que registra a URL e lança — e rodei a suíte
da `develop` limpa com ela ligada. Isso transformou "algum arquivo pode estar
alcançando a rede" numa lista exata: 4 arquivos, 15 testes, e as URLs
(`/health`, `/teams`, `/rounds`, `/organizer/problems`, `/sse`). Duas premissas
da Spec caíram com isso:

- `vi.mock('@/lib/api')` não prova estar offline. Três dos quatro vazamentos são
  o `fetch` cru do `sse-client.ts:55`, que o cliente RPC nunca toca — e o
  `__root.test.tsx`, que *tem* o mock, ainda assim vaza. De quebra, o mock dele
  omite `api.rounds`, que a home chama: o `TypeError` é engolido pelo
  react-query e o teste passa mesmo assim.
- A "salvaguarda contra desviar um router desmontado" que a Spec pedia avaliar
  não descreve bug nenhum: o efeito do `__root` faz `return subscribe(...)`, ou
  seja, a inscrição *é* o cleanup do `useEffect`.

O paralelo com o kata é o único ângulo de framework aqui, e é por contraste: o
`kata verify --strict-coverage` do back dá ao lado servidor uma rede de proteção
estrutural que o front não tem — no front, "todo teste está isolado da rede" era
convenção verbal até esta task. Se o kata algum dia crescer uma noção de
"garantias de suíte" para além de cobertura, este é o formato que funcionou
aqui: uma guarda que falha o teste, não um lint que confere a forma do arquivo.

## Why it matters

Reforça que o gatilho "attempt a report" produz sinal mesmo quando a resposta é
"kata fora de quadro" — e aqui o sinal aproveitável é metodológico: sondar antes
de planejar deu números medidos no lugar de estimativas, e derrubou duas
suposições da própria issue.

## Metrics

- Consultas ao `kata-docs` MCP: **0**. Documentos lidos: **0**. Custo de
  round-trip ao MCP: **0 tokens**. Teria ajudado? Não — puro overhead.
- Custo do planejamento: ~20 chamadas de ferramenta. Três rodadas de
  `AskUserQuestion` (4 + 2 + 1 perguntas); as decisões que sobraram eram de
  estratégia de teste e de escopo, não de framework.
- Custo da sondagem (worktree `plan-168-probe`): `pnpm install` + 3 execuções da
  suíte cheia (~35 s cada) + a varredura rodando os 61 arquivos um a um
  (~4 min) + `pnpm -r typecheck`. Caro para um passo de planejamento, e pagou:
  o plano entrega números medidos (17/17, 61 arquivos / 458 testes, 61 arquivos
  isolados com 0 falhas) em vez de passos "verificar que passa".
- Atrito que valeu registrar, e não é do kata: o `EnterWorktree` do harness
  parte de `origin/main`; este repo exige `develop`, então todo worktree precisa
  de um `git reset --hard origin/develop` logo após entrar. E a isolação de
  worktree recusou dois comandos compostos legítimos (um heredoc + `sed`, e um
  laço de `npx vitest` sobre uma variável) por não conseguir provar que não eram
  git — resolvido escrevendo os arquivos com a ferramenta de escrita e o laço
  como script no scratchpad. Custo: 2 turnos.
