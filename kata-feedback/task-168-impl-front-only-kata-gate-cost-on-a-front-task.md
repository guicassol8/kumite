# Task #168 (implementação): tarefa 100% front, mas a régua do kata rodou 4 vezes

**Found while**: kumite #168 — guarda de rede na suíte vitest do front
**Where in kata**: `kata verify`, e o acoplamento entre `back/.env` e
`pnpm -r test` (via `loadEnvFile`/config do back)

## What

Observação, não bug. O #168 é uma task inteiramente dentro de `front/`:
nenhum `*.schema.ts`, nenhuma rota, nenhum `.hurl`, nenhum arquivo do `back/`
tocado. Ainda assim, cada um dos dois commits pagou `kata verify` (65
arquivos) mais a suíte inteira do back (565 testes, ~60 s) no `pre-commit`.
Zero consultas ao `kata-docs` MCP foram necessárias — a task nunca encostou
numa superfície do kata.

O atrito real não foi o `verify` (0,8 s, sempre verde), e sim o segundo
efeito: **o `pre-commit` de uma task front não commita numa worktree nova até
a worktree ter `back/.env` + Postgres próprio**. O primeiro commit foi
bloqueado com 18 suítes vermelhas e a mensagem

```
Invalid back/ environment — 1 variable missing or invalid:
  - JWT_SECRET: required, but not set
```

que é *exatamente* a mensagem legível que a #164 introduziu — ela funcionou:
diagnóstico em uma leitura, sem stack trace. O custo foi o setup em si
(copiar dois `.env.example`, achar uma porta livre — a 5441 já estava tomada
por outra worktree —, `docker compose up -d`, `db:migrate`), ~6 turnos para
uma task que não lê o banco.

## Why it matters

Não é culpa do kata; é a soma "monorepo + gate ladder global + worktree por
task". Mas vale registrar do lado do kata porque a superfície de config do
back é o que dispara o bloqueio, e porque é a segunda vez que a exigência de
`JWT_SECRET` no boot aparece em relato (ver
`task-97-planning-env-failure-surface-kata-cannot-see.md` e
`process.env reassign` na memória do projeto): o config do back é *estrito no
import*, então qualquer suíte que importe o app precisa do env completo,
mesmo os 6 testes de `notifications` que só renderizam HTML de e-mail e não
tocam JWT nenhum.

## Metrics

- Consultas ao `kata-docs` MCP nesta task: **0**. Custo: 0 tokens. Não
  faltaram — a task não tinha superfície kata. Chutar não era risco aqui.
- `kata verify`: 4 execuções, 0,77–1,47 s cada, sempre `no problems found`
  (65 arquivos). Nenhum achado; nenhum falso positivo. Cerimônia barata.
- `pnpm -r test` no `pre-commit`: ~100 s por commit, dos quais ~60 s são a
  suíte do back — que esta task não podia quebrar.
- Turnos gastos com o ambiente do back (env, porta, compose, migrate) numa
  task front: ~6 de ~25. Nenhum deles produziu linha de código.

## Suggested fix (optional)

Nada a corrigir no kata. Uma ideia, se algum dia valer: o config estrito do
back podia distinguir "required no boot do servidor" de "required para
importar o módulo" — os testes de `notifications` provam que existe código do
back cujo teste não precisa de `JWT_SECRET`. Isso é decisão de kumite tanto
quanto de kata, então fica como observação, não como pedido.
