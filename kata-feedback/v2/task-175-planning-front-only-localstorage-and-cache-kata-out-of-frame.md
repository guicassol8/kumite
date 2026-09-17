# Planejar o isolamento de sessão entre usuários no mesmo navegador não tocou
# o kata em ponto nenhum — mas a rede quebrou o `gh` de um jeito novo, silencioso

**Found while**: planejamento do #175 (workspace do Blockly e cache do React
Query sobrevivem ao logout; achados #2 `[confirmado]` e #19 `[estático]` do
bughunt de 2026-09-10).

**Where in kata**: nenhum ponto de contato. Zero consultas ao `kata-docs` MCP,
zero execuções de `kata verify` ou hurl, zero leituras em `back/`. A única
incursão no back foi **de leitura**, em
`back/src/modules/users/users.schema.ts`, para confirmar que `PublicUserSchema`
expõe `id` — o campo que passa a escopar a chave do `localStorage`.

## What

Observação, sem bug. A task é 100% front: chave de `localStorage` sem escopo de
usuário (`front/src/lib/workspace-storage.ts:3`) e `queryClient` criado inline
no `main.tsx:18`, fora do alcance do `clearSession`. Todo o diagnóstico saiu de
leituras locais em `front/src/lib/{workspace-storage,session,api}.ts`,
`front/src/hooks/use-workspace-autosave.ts`, `front/src/components/header.tsx` e
`front/src/routes/problem.$id.tsx`. Nada nele depende de saber como o kata
funciona, e o plano não prevê mudança de schema, migration, `.hurl` ou
comportamento de rota — `kata verify` vai rodar no portão final sobre um `back/`
que ninguém tocou, como ceremônia pura (mesmo padrão já registrado nos #178 e
#179).

Vale registrar que a única pergunta que chegou perto do back — "o `GET /me`
devolve `id`?" — foi respondida por **um grep e um `sed`** no
`users.schema.ts`, em ~2 chamadas de ferramenta. Consultar o `kata-docs` para
isso teria sido overhead: a pergunta é sobre o schema do *kumite*, não sobre a
API do framework. A fronteira continua nítida e fácil de enxergar: quando a
dúvida é "qual a forma do meu DTO", o arquivo responde; quando é "como o kata
trata X", aí sim o MCP pagaria.

## Why it matters

Terceiro planejamento seguido de trilha front-only em que o kata não entra em
quadro, e o segundo em que nem a quina do `output`/TS2367 aparece. Isso é sinal
útil por si: a fatia de tasks do kumite que **não** encosta no framework é
grande, e para ela o custo marginal do `kata-docs` é zero porque ninguém o
chama. Nenhuma ação pedida ao kata.

O que **mudou** desta vez, e é o motivo real desta entrada, é o atrito de
ambiente em volta do `gh` — um modo de falha novo, diferente do que a memória do
projeto já registra.

## Metrics

- Consultas ao `kata-docs` MCP: **0**. Documentos lidos: **0**. Custo de
  round-trip ao MCP: **0 tokens**. Teria ajudado? Não — nada no plano é
  pergunta de framework.
- Custo total do planejamento: ~18 chamadas de ferramenta. Duas rodadas de
  `AskUserQuestion` (4 + 3) = **7 perguntas**, todas de produto/arquitetura de
  front (a contradição AC1×AC4, `manual` × `expired`, chaves legadas, onde
  limpar o cache, assinatura do storage, ausência de usuário, forma da
  evidência). **Nenhuma** de framework.
- Custo de confirmar o único ponto do back: **2 chamadas** (grep +
  `sed -n '1,45p'` em `users.schema.ts`). Pagou-se — virou a decisão 5 do plano
  sem nenhum ida-e-volta.

### Atrito de ambiente (não-kata), com um modo de falha novo

O `gh` custou **~12 chamadas de ferramenta e vários minutos** antes de a
primeira linha da issue aparecer. Em ordem:

1. **Queda real de rede.** `gh issue view 175` deu
   `dial tcp 4.228.31.149:443: i/o timeout`. Confirmei que não era o `gh` nem o
   sandbox: `1.1.1.1:443` e `8.8.8.8:53` também falharam, com rota default
   presente via `wlan0`. Uma bateria de ~20 tentativas com backoff (duas rodadas
   em background) esgotou sem sucesso.
2. **`exit 0` com stdout vazio** — o modo novo. Com a rede *voltando*, três
   invocações seguidas de `gh` (`issue view`, `auth status`, `api rate_limit`)
   retornaram **exit 0, zero bytes em stdout e zero bytes em stderr**. Redirecionar
   para arquivo confirmou: 0 bytes. Segundos depois, os mesmos comandos
   responderam normalmente. A memória do projeto registra "saiu vazia com exit 0"
   para o `gh issue view`; aqui o mesmo aconteceu com `gh auth status` e
   `gh api`, que nem sequer fazem GraphQL — ou seja, **não é específico do
   `issue view`**. Um `exit 0` mudo é pior que um timeout: sem o cuidado de
   checar `wc -c`, dá para concluir "a issue está vazia" e seguir planejando no
   vácuo.
3. **REST ok, GraphQL fora.** Recuperada a rede, `gh api rate_limit` (REST) e
   `curl https://api.github.com` (200) funcionaram, mas
   `gh issue view 175 --comments` continuou dando i/o timeout — porque usa
   **GraphQL**, e `api.github.com/graphql` resolvia para um IP que não
   respondia. A saída foi trocar por REST:
   `gh api repos/<owner>/<repo>/issues/175 --jq '...'`, que pegou de primeira.

**O que eu registraria na memória do projeto**: (a) validar saída de `gh` por
tamanho, não por exit code — `exit 0` + stdout vazio é um estado alcançável e
mudo; (b) quando `gh issue view` falha mas `gh api` REST funciona, o problema é
o endpoint GraphQL, e `gh api repos/.../issues/N` é o contorno direto. Ambos
independem do kata; ficam aqui só porque foram o custo dominante deste
planejamento — **mais caro que todo o resto do Step 1 somado**.

## Suggested fix (optional)

Nada para o kata.
