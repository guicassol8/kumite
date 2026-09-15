# Planejar o #177 foi um `.set()` de drizzle: kata fora de quadro, e o `kata-docs` ausente pela quinta sessão seguida

**Found while**: planning-tasks para o #177 (reset por OTP não limpa
`mustChangePassword` e prende o aluno na tela de troca — P1, `stack:back`,
achado #4 do bug hunt de 2026-09-10).

**Where in kata**: `kata-docs` MCP server (`.mcp.json`) — ausente; `kata verify`
e hurl só como degraus da escada de gates, não como fonte de informação.

## What

**1. Zero superfície de kata no diagnóstico.** O bug inteiro vive em três
`db.update(usersTable).set({...})` do drizzle — `auth.service.ts:101`,
`password-reset.service.ts:255` e `:421`. Um `grep` por `passwordHash` filtrado
por `set(|values(|insert` listou os três caminhos de escrita em uma chamada e
o diff entre eles era o bug. Nenhuma rota, schema, DI, JWT ou middleware novo;
nenhuma decisão do plano dependeu de uma API do framework. `defineRoute`,
`defineMiddleware` e o envelope de erro só apareceram como *leitura de
contexto* (confirmar que `requirePasswordUpToDate` lê a flag do usuário
resolvido, e que `POST /auth/login` devolve só `{ token }`, então o front lê a
flag do `GET /me`).

**2. `kata-docs` ausente pela quinta sessão consecutiva de planejamento.**
Nenhuma ferramenta `mcp__kata-docs__*` na superfície da sessão — mesmo silêncio
já registrado em `task-98-...`, `task-143-...`, `task-145-...` e
`task-174-...`. O `.mcp.json` continua intacto. Desta vez não custou nada
(nenhuma pergunta de kata para fazer), mas o streak agora é 5 e vale contar:
a ausência não é mais um incidente, é o estado padrão das sessões de
planejamento neste repo.

**3. Um ponto onde o hurl *é* a ferramenta certa — e um onde ele não alcança.**
O critério 4 do issue ("um reset por OTP que falha não mexe na senha nem na
flag") é exatamente o tipo de invariante que o hurl prova melhor que unit test:
organizador reseta → senha temporária → `complete-password-reset` com OTP
errado → `GET /me` ainda `mustChangePassword: true` e `/teams` ainda 403, tudo
por HTTP real. Já o caminho feliz é **inalcançável** pelo hurl por desenho da
aplicação, não do kata: o OTP em claro só existe na notificação
(`notifications.service.ts:105`), nenhuma rota o devolve, e o hurl não tem como
ler stdout do servidor nem caixa de email. A divisão ficou explícita no plano —
unit test para o que exige observar o segredo, hurl para o que um cliente
black-box realmente vê. Não é reclamação: é o limite esperado de um runner de
HTTP, e vale registrar porque é a segunda vez que o mesmo limite decide onde
uma asserção mora (a primeira foi `review-163-hurl-arrange-first-is-the-only-teardown.md`).

**4. Regra de propriedade de arquivo `.hurl` entrou em conflito com reuso de
cadeia.** O `password-reset.hurl` declara no cabeçalho ser "the only `.hurl`
touching these two routes". Mas a cadeia de arrange que o critério 4 precisa
(organizador autentica → step-up com `adminPassword` → reseta → captura a senha
temporária → loga o alvo) já existe montada nos passos 21–25 do `users.hurl`.
Reproduzi-la no `password-reset.hurl` custaria um signup, um login de
organizador e um slot do teto de `organizer_reset`; a alternativa foi furar a
regra de propriedade e atualizar os dois cabeçalhos. Como o hurl não tem
`include`/fixture compartilhada, *toda* asserção que precise de um arranjo caro
cai nesse mesmo dilema: duplicar o setup ou quebrar o um-arquivo-por-rota.
Uma forma de arranjo reutilizável entre arquivos (mesmo que só um bloco de
requests nomeado e importável) resolveria a classe inteira. Sugestão, não
bloqueio.

## Why it matters

Mais um ponto de dados para a mesma leitura que os últimos planejamentos vêm
acumulando: o kata cobre bem a borda HTTP (rota, schema, guard, envelope de
erro) e some justamente na camada onde os bugs deste repo têm nascido — a
escrita no banco, onde um `.set()` a menos passa por `kata verify --strict-coverage`,
pelo typecheck e pelos 862 linhas de teste do módulo sem levantar nada. Não é
defeito do kata (a invariante "todo caminho que grava senha decide a flag" é
regra de domínio, não de framework), mas delimita o que a escada de gates
consegue prometer.

## Metrics

- **Consultas ao `kata-docs`**: 0 (servidor ausente). Nenhuma pergunta ficou
  sem resposta por isso — nenhum chute no plano.
- **Custo de contexto em kata**: desprezível. Três leituras locais responderam
  tudo: `middlewares/auth.ts` (o guard lê `user.mustChangePassword`),
  `auth/auth.route.ts` + `auth.schema.ts` (login devolve só `{ token }`),
  `db/schema.ts:58` (a coluna). Nenhum `.d.ts` do `@katajs-framework/core`
  precisou ser aberto — primeira vez em várias sessões que nem o fallback foi
  necessário.
- **`kata verify` / hurl**: não executados nesta sessão (planejamento não roda
  código); entram como degraus 2 e 4 da escada no T4 do plano.
- **Fricção de harness, não de kata**: a API do GitHub ficou inalcançável no
  começo da sessão (`dial tcp 4.228.31.149:443: i/o timeout`, ~6 tentativas ao
  longo de ~1 min, com o resto da internet respondendo normalmente). Custou uns
  7 tool calls de retry antes do `gh issue view` passar. Nada a ver com kata —
  registrado só porque o pedido inclui fricção de harness e porque um skill que
  começa obrigatoriamente com `gh issue view` fica 100% bloqueado nesse cenário.
