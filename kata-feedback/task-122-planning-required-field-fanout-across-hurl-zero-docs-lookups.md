# Tornar um campo obrigatório espalha 25 edições manuais pelos `.hurl`

**Found while**: planejamento da #122 (adicionar `name` obrigatório ao signup)
**Where in kata**: superfície de hurl como gate de E2E (o script
`hurl --test --jobs 1 src/modules/*/*.hurl` que o kumite herdou)

## What

Observação, não bug do kata. Adicionar **um** campo obrigatório ao
`SignupBodySchema` obriga a editar **26** corpos de `POST /auth/signup`
espalhados por **11** arquivos `.hurl` de 11 módulos diferentes — auth (5),
teams (5), submissions (3), ranking (3), event-codes (2), users (2), e um cada
em event-config, password-reset, problems, rounds, stats.

A causa é que hurl não tem nada equivalente a um fixture ou helper
compartilhado: cada arquivo que precisa de um usuário autenticado repete o
signup inteiro, literal, inclusive o corpo JSON. Não existe include, macro ou
"setup file" — o corpo da request é sintaxe, não dado parametrizável além das
`--variable`. Dá pra passar valores por variável, mas não dá pra fatorar a
*request*.

O efeito prático é que o custo de uma mudança de schema no kata cresce com o
número de módulos que precisam de auth, não com o número de módulos que a
mudança realmente afeta. Nenhum dos 10 arquivos fora de `auth.hurl` tem
qualquer interesse no campo `name` — eles só precisam de um usuário logado.

É a mesma família de problema já registrado em
`task-161-planning-hurl-has-no-teardown-zero-docs-lookups.md`: hurl é ótimo como
asserção de contrato HTTP e fraco como suíte com estado compartilhado e
pré-condições comuns.

## Why it matters

Qualquer app kata cresce assim: quanto mais módulos, mais arquivos `.hurl`
repetem o mesmo bloco de autenticação. Uma mudança de campo obrigatório no
signup — que é uma mudança comum e de baixo risco conceitual — vira um patch
mecânico grande, exatamente o tipo de diff em que uma edição errada passa
despercebida no review. E o feedback é tardio: o erro só aparece quando a suíte
hurl roda contra um banco de verdade, não no typecheck nem no `kata verify`.

## Metrics

- Consultas ao `kata-docs` MCP neste planejamento: **zero**. Nada da task
  dependia de API, DI, middleware ou envelope de erro do kata — a única
  interação com o framework é `SignupBodySchema` ser um zod comum e o 422 de
  validação já ser conhecido (documentado em
  `kumite-kata-422-untyped-in-hc-client`). Nenhum custo de lookup, nenhum ganho
  perdido por não fazer.
- Custo do planejamento: ~12 leituras/greps (schema do banco, users e auth
  service/schema, teams schema/service, seed, signup.tsx, header, session,
  catálogo i18n, contagem de call sites em hurl e e2e), 2 rodadas de perguntas
  ao usuário (8 decisões), nenhuma execução de app ou de banco.
- Blast radius medido, não estimado: 26 call sites em hurl, 17 arquivos em
  `front/e2e/`, 2 arquivos de teste unitário no back.
- Fricção de harness registrada: nenhuma nesta sessão.

## Suggested fix (optional)

Nada obrigatório. Se o kata quiser reduzir isso na sua superfície de hurl, a
opção mais barata é documentar/gerar um arquivo de setup cujo output (um token)
seja consumível pelos demais via `--variable` — trocando 26 signups literais por
um signup e 10 usos de `{{token}}`. Alternativa mais estrutural: um helper de
`kata verify`/CLI que rode um script de bootstrap antes do glob de `.hurl`.
