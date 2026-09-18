# Triagem do lote v2 — 2026-09-17

Brief para uma sessão rodando em `~/Projetos/kata`, no mesmo espírito do
`v1/TRIAGE.md`. Este lote tem **157 relatórios**, escritos do lado
consumidor (kumite) entre 2026-09-01 e 2026-09-17, contra o
`@katajs-framework/core` 0.4.2. Foi arquivado inteiro porque a regra
"attempt a report every time" produziu 103 arquivos que dizem alguma variação
de "kata fora de frame, `kata verify` foi cerimônia" — e enterrou os poucos
que carregam sinal. A regra mudou junto com este arquivamento (ver
`kata-feedback/README.md`): agora só entra relatório quando kata entrou em
frame ou houve fricção; o no-op vira uma linha no `LEDGER.csv`.

Os agrupamentos abaixo vieram do **nome e do título** de cada arquivo, não de
uma leitura completa de todos — trate como índice para a triagem humana, não
como veredito. Os cinco temas em que vale gastar tempo:

1. **hurl não é re-executável e não tem teardown** (17 relatórios, o custo
   recorrente mais caro do lote: três runs completos para diagnosticar um
   review, banco envenenado pelo vitest, `count` trap em array vazio). Do lado
   kumite, #287 entregou `pnpm db:reset`; do lado kata, a pergunta é se o
   harness de hurl quer um hook de reset/teardown ou uma convenção documentada.
2. **O cliente `hc<AppType>` mente sobre tipos** (5): `z.coerce.date()` vira `Date`
   no tipo mas `string` no wire, e o 422 automático não existe no tipo da
   resposta. Já eram conhecidos no v1; o v2 mede o custo acumulado (10
   workarounds em 6 arquivos, nenhum lintável).
3. **`kata verify` é cego a…** (5): concorrência, drift de nome de env,
   arquivos fora de `src/`, semântica de auth. Cada um propõe uma regra ou
   documenta que aquilo é território de teste, não de lint.
4. **MCP `kata-docs` indisponível** (6): timeout de conexão em sessões
   seguidas; as respostas vieram dos `.d.ts` empacotados ou do repo fonte. No
   kumite o MCP passou a ser tratado como opcional (#288), então o sinal aqui é
   "o `.d.ts` respondeu" — vale mais investir na tipagem do que no server.
5. **Achados de framework propriamente ditos** (21): `c.json` sem headers,
   `onError` engolindo semântica de driver, re-validação de output que só
   corta chaves, `raw()` travando em stream infinito, `schema-file-naming`
   rejeitando um layout aprovado, `jwtAuth.resolve` com 401 opaco, falta de
   rate limit e de `clientIp`, e o custo de um banco fora do ar na suíte.

---

## 1. Achados de framework

- `auth-identity-221.md` — Strict verification during the authentication redesign
- `c-json-has-no-headers-either-and-verify-lets-adhoc-errors-through.md` — `c.json` has no headers argument either — and `no-adhoc-error-shape` lets the workaround through
- `codex-skills-workflow-docs-verification.md` — Kata verification during Codex workflow documentation changes
- `cross-module-service-import-and-optional-secrets-clean.md` — Cross-module service import and optional-secret DI, both friction-free
- `db-unreachable-fails-slow-and-loud-in-test-suite.md` — A DB-unreachable test run costs 6 minutes and 338 stack dumps instead of one line
- `home-teams-identity-verification.md` — Front-only identity change and strict verification
- `no-rate-limit-middleware-or-client-ip-helper.md` — No rate-limit middleware, and no first-class client IP
- `onerror-envelope-swallows-driver-error-semantics.md` — app.onError's unified envelope hides the difference between "our error" and "an uncaught driver exception"
- `output-revalidation-strips-keys-not-rows.md` — Output re-validation strips unknown *keys*, but cannot drop unwanted *rows* — a defence-in-depth expectation kata can't meet
- `output-shape-mismatch-error-detail.md` — Output shape mismatch gives no field-level detail
- `raw-output-infinite-stream-strict-hang.md` — `raw()`'s strict-mode body validation hangs forever against a never-ending stream
- `review-clean-on-pr-131-home-round-results.md` — kata verify stayed clean through a review-session fix round-trip too
- `services-union-doc-decided-the-codegen-surface.md` — `guide/services.md` decidiu a superfície de erro antes de eu inventar uma
- `task-134-front-only-gate-ladder-runs-the-whole-back-suite.md` — A front-only task still pays the full back gate ladder (and a DB) on every commit
- `task-149-front-only-gate-ladder-runs-back-suite-that-wipes-the-e2e-db.md` — A front-only task's gate ladder wipes the database its own e2e run needs
- `task-156-planning-env-config-outside-kata-surface.md` — Env config vive fora da superfície do kata — planejamento com zero lookups
- `task-174-jwtauth-resolve-401-is-opaque-and-route-enumeration-is-private.md` — `jwtAuth.resolve` can only fail one way, and enumerating routes needs a private marker
- `task-174-planning-resolve-401-has-no-custom-code-dts-answered-it.md` — `jwtAuth`'s `resolve` rejection has no custom error code, and that asymmetry with `guard()` decided a product trade-off
- `task-231-implementing-schema-file-naming-blocked-approved-plan.md` — schema-file-naming rejected the approved plan's file layout
- `task-97-planning-env-failure-surface-kata-cannot-see.md` — Falha de env é invisível pro kata — e o kumite está reimplementando a superfície à mão
- `task-98-docs-only-errata-verify-cheap-suite-expensive.md` — The module lock is strict enough to need an ADR errata — and the docs-only gate ladder is 99% test suite

## 2. `kata verify` cego a algo

- `review-143-guardrail-test-covers-what-verify-cannot.md` — Review of #143: the guardrail test covers exactly the gap `verify` can't
- `task-142-review-verify-blind-to-concurrency.md` — `kata verify --strict-coverage` passa limpo num rate limiter que não segura sob concorrência
- `task-156-implementation-verify-blind-to-env-name-drift.md` — `kata verify` is blind to env-var name drift between config and consumers
- `task-162-review-verify-blind-to-files-outside-src.md` — `kata verify` reports "62 files checked" but is blind to back/scripts
- `task-174-review-verify-cannot-see-auth-semantics-and-the-route-marker-is-the-only-lever.md` — `kata verify` is blind to auth *semantics*, and the private route marker was the only way to review them

## 3. hurl: re-execução, teardown, `count` trap

- `first-query-param-route-and-a-hurl-count-trap.md` — First `input.query` route in kumite: smooth, plus a hurl `count` trap on an empty match
- `hurl-and-unit-tests-fight-over-one-database.md` — hurl has no reset story, and the unit tests silently eat its fixtures
- `hurl-test-mode-parallel-races-a-global-db-invariant.md` — `hurl --test`'s default parallel execution races a global DB invariant across files
- `review-140-gate-ladder-oom-and-hurl-tax-reconfirmed.md` — The gate ladder gets OOM-killed before it gets a chance to fail honestly
- `review-152-verify-clean-hurl-has-no-duplicate-request-check.md` — `kata verify` clean on #94's review; hurl happily ran the same request twice
- `review-163-hurl-arrange-first-is-the-only-teardown.md` — Arrange-first is the only teardown hurl has, and the suite still isn't rerunnable
- `review-242-hurl-non-rerunnable-cost-three-runs.md` — hurl's non-re-runnability cost three full suite runs to diagnose
- `schema-file-naming-misses-hurl-and-test-files.md` — `kata/schema-file-naming` never sees `.test.ts` or `.hurl` — two of the five suffixes it advertises are unenforced
- `task-156-review-hurl-suite-not-idempotent-after-vitest.md` — hurl is order- and state-coupled: the vitest suite poisons it, and kata offers no reset seam
- `task-161-implementation-hurl-has-no-teardown.md` — hurl has no teardown hook, so "clean up in the last step" only cleans up on green
- `task-161-planning-hurl-has-no-teardown-zero-docs-lookups.md` — hurl não tem teardown: "limpa no último passo" só funciona na suíte verde
- `task-177-review-out-of-band-secret-flows-are-unhurlable.md` — #177 review: kata was only a gate again — and hurl structurally cannot reach an out-of-band secret
- `task-184-review-hurl-needed-a-volume-wipe-not-just-reseed.md` — Reviewing #184's PR: hurl re-run needed a full volume wipe, not just db:seed
- `task-50-organizer-moderation-hurl-count-trap-again.md` — Task #50 (organizer team moderation): zero kata-docs lookups, hurl `count` trap reconfirmed
- `task-51-organizer-listing-hurl-empty-array-count-trap.md` — Task #51 (organizer team listing): zero kata-docs lookups, a second hurl empty-value trap
- `task-53-implementation-hurl-host-port-split-and-reset-tax.md` — hurl's host variable and the app's PORT are two knobs for one fact
- `task-97-review-env-surface-still-handrolled-verify-and-hurl-smooth.md` — Review da #97: `parseEnv` confirmou a lacuna de config do kata; `kata verify` e hurl não atrapalharam

## 4. Tipagem do cliente `hc` e o 422

- `hc-client-date-typed-as-date-but-wire-is-string.md` — `hc<AppType>` types coerced-date output fields as `Date`, but the wire value is a string
- `hc-date-typing-lie-ten-workarounds-later.md` — The `hc` date type-lie is now paid for in 6 files — and the workaround is unlintable
- `task-145-review-hurl-cooldown-and-untestable-422.md` — Revisão da #145: hurl não é re-executável quando a rota tem estado in-memory, e o 422 continua invisível
- `task-49-front-only-422-envelope-untyped-in-hc-client.md` — kata's automatic 422 validation envelope has no type on the `hc` client, even on routes with a declared error map
- `task-94-untyped-422-predicted-and-blocked-the-gate-ladder.md` — The untyped 422 envelope finally blocked the gate ladder — exactly the TS2367 `task-49` predicted

## 5. MCP `kata-docs` indisponível

- `kata-docs-mcp-connect-timeout-during-planning.md` — kata-docs MCP failed to connect during planning
- `task-143-planning-docs-mcp-down-again-guard-answered-by-dts.md` — kata-docs MCP down again during planning — the bundled .d.ts answered the question instead
- `task-145-planning-mcp-absent-answers-came-from-past-feedback.md` — Planning #145: kata-docs MCP absent again — and the two kata questions were answered by this folder, not by kata
- `task-176-implementing-verify-silent-on-drizzle-mcp-never-consulted.md` — Implementação de bug de corrida no ranking: kata fora do frame, MCP nunca consultado
- `task-181-planning-blocks-codegen-mcp-absent-error-code-answered-by-dts.md` — Planning da #181: codegen de blocos — kata-docs MCP ausente de novo; "kata restringe o código de erro?" foi respondido pelo `.d.ts`
- `task-98-planning-docs-mcp-down-third-time-source-repo-as-fallback.md` — kata-docs MCP down a third consecutive planning session — this time the kata source repo was the fallback

## 6. Sem sinal novo — não virar issue

103 relatórios de sessões em que kata não entrou em frame ("front-only",
"docs-only", "zero lookups", "verify was pure ceremony", "verify clean").
Úteis só como evidência de que o gate rodou e passou; nenhum precisa de ação.
São a razão da nova regra.

- `review-113-verify-reconfirmed.md` — Review of #113 reconfirms the clean-verify pattern; nothing new to add
- `review-115-verify-clean-front-only.md` — kata verify clean on a front-only PR, zero kata-docs lookups needed
- `review-133-organizer-teams-clean-verify.md` — Review #133 (organizer team moderation): clean verify, one hurl DB-state snag (not kata's fault)
- `review-141-verify-clean-hurl-needed-a-volume-wipe.md` — Review of #141: verify clean, and hurl needed a full volume wipe again
- `review-151-e2e-only-pr-verify-clean-and-another-db-wipe.md` — Reviewing an e2e-only PR: `kata verify` clean and structurally blind, plus a fifth DB-wipe sighting
- `review-of-39-participant-route-clean-verify.md` — Reviewing #39/PR #112: kata surface was easy to verify, no docs needed
- `review-of-a-front-only-pr-leaves-kata-untouched.md` — Reviewing a front-only PR: `kata verify` is a fast, honest no-op — and the gate ladder still pays for the whole back suite
- `round-detail-endpoint-no-docs-lookup.md` — kata-docs wasn't needed to add a new participant route
- `rounds-api-heavy-back-task-zero-docs-lookups.md` — Heaviest-kata-surface task yet needed zero kata-docs MCP queries
- `seed-problems-task-14-no-docs-needed.md` — Problem seed task (#14): zero kata-docs lookups, clean verify
- `task-122-implementing-name-column-verify-hurl-clean-zero-lookups.md` — Implementando a #122: coluna `name` — kata verify e hurl passaram de primeira, zero consultas ao kata-docs
- `task-122-planning-required-field-fanout-across-hurl-zero-docs-lookups.md` — Tornar um campo obrigatório espalha 25 edições manuais pelos `.hurl`
- `task-125-implementation-drizzle-only-kata-passive.md` — Implementação #125: task 100% drizzle, kata só como portão — zero lookups no kata-docs
- `task-125-planning-drizzle-only-kata-not-in-frame.md` — A DB-constraint task lives entirely below kata's floor — zero docs lookups
- `task-125-review-verify-and-hurl-as-regression-net-zero-lookups.md` — Review #125: `kata verify` e hurl como rede de regressão de uma mudança puramente de banco — zero lookups no kata-docs
- `task-142-implementation-zero-docs-lookups.md` — Implementing #142: zero kata-docs lookups, and one route surface that helped
- `task-143-implement-verify-clean-guard-per-route-scaled.md` — Implementing #143: `guard()` scaled to 39 routes, verify clean, zero docs lookups
- `task-145-implementation-new-public-route-zero-docs-lookups.md` — Um módulo público novo do zero, com zero consultas ao kata-docs
- `task-150-planning-e2e-flake-kata-not-in-frame.md` — A test-infra task where kata never entered the frame at all
- `task-150-sse-route-fix-zero-docs-lookups.md` — A `streamSSE` route fix, and zero kata-docs lookups to make it
- `task-153-review-zero-kata-surface-in-an-e2e-review.md` — Reviewing a mostly-e2e PR: kata was inert, `kata verify` was free
- `task-154-implementing-front-only-kata-cost-was-noise.md` — #154 (implementing): tarefa 100% front — kata só apareceu como custo fixo no ladder
- `task-154-planning-header-link-kata-out-of-frame.md` — Planejar o link de home no header não tocou em nenhuma superfície do kata
- `task-154-review-kata-out-of-frame-verify-still-clean.md` — #154 (review): kata fora do quadro de novo — `kata verify` como custo fixo, zero lookups
- `task-155-planning-pure-front-layout-kata-out-of-frame.md` — Planejar um bug de layout puro no front nunca cruzou com o kata
- `task-155-pure-front-implementation-kata-only-as-a-gate.md` — Task #155: implementação 100% front — kata só apareceu como portão
- `task-155-review-kata-verify-as-a-no-op-gate.md` — Review da #155 (PR #160): kata verify como portão no-op, e o custo real do review
- `task-162-impl-email-body-kata-neutral-verify-fast.md` — Task #162 implementation: kata stayed out of the way; `verify` fast and quiet
- `task-162-planning-docs-mcp-absent-ses-email-out-of-frame.md` — kata-docs MCP ausente da sessão (4ª ocorrência) — task de e-mail SES não precisou dele
- `task-168-impl-front-only-kata-gate-cost-on-a-front-task.md` — Task #168 (implementação): tarefa 100% front, mas a régua do kata rodou 4 vezes
- `task-168-planning-vitest-network-guard-kata-out-of-frame.md` — Uma guarda de rede no vitest do front nunca cruzou com o kata
- `task-168-review-kata-out-of-frame-verify-was-the-only-back-signal.md` — Task #168 (review): kata fora de quadro, mas `kata verify` foi o único sinal de back que o review teve
- `task-171-implementing-verify-and-hurl-clean-no-mcp-lookups.md` — kata verify + hurl clean run, no kata-docs lookups needed
- `task-171-review-test-isolation-fix-kata-out-of-frame.md` — Reviewing a Vitest isolation fix — kata never in frame, verify+hurl still clean signal
- `task-173-review-signup-name-kata-clean-zero-lookups.md` — Reviewing the signup-name column PR — kata clean again, zero MCP lookups
- `task-175-implementation-front-only-kata-verify-was-pure-ceremony.md` — Task #175: implementação 100% front — `kata verify` rodou 6× sem nada para dizer
- `task-175-planning-front-only-localstorage-and-cache-kata-out-of-frame.md` — Planejar o isolamento de sessão entre usuários no mesmo navegador não tocou
- `task-175-review-front-only-kata-verify-clean-mcp-absent.md` — Task #175 (review): diff 100% front — `kata verify` limpo e sem nada a dizer
- `task-176-planning-drizzle-and-domain-only-zero-docs-lookups.md` — Planejamento da #176 não encostou no kata — zero consultas ao kata-docs
- `task-176-review-nul-byte-in-source-blinds-diff-kata-out-of-frame.md` — Review de bug de corrida no ranking: kata fora do frame, e um byte NUL cru cegando o diff
- `task-177-implementing-one-line-drizzle-fix-zero-docs-lookups.md` — #177 implementation: a one-line drizzle fix, kata never in frame
- `task-177-planning-drizzle-one-liner-kata-out-of-frame-mcp-absent-again.md` — Planejar o #177 foi um `.set()` de drizzle: kata fora de quadro, e o `kata-docs` ausente pela quinta sessão seguida
- `task-178-implementing-front-only-kata-verify-was-pure-ceremony.md` — Task #178 implementation: front-only fix, `kata verify` ran 5× and said nothing
- `task-178-planning-front-only-remount-kata-out-of-frame.md` — Planejar a remontagem do editor foi 100% front — kata fora de quadro, e o
- `task-178-review-e2e-flake-diagnosis-kata-out-of-frame.md` — Task #178 review (PR #245): diagnóstico de flake no e2e, kata fora de quadro
- `task-179-implementing-front-only-kata-verify-was-pure-ceremony.md` — Front-only session bug: kata never in frame, `kata verify` ran four times for nothing
- `task-179-planning-session-hydration-front-only-kata-out-of-frame.md` — Planejar a recuperação de hidratação da sessão foi 100% front — mas o `output`
- `task-179-review-front-only-verify-green-on-65-untouched-files.md` — Review of a front-only PR: `kata verify` was the only kata surface, and it had nothing to check
- `task-180-implementation-front-only-kata-was-pure-gate-tax.md` — Task #180 implementation: front-only fix, kata only ever ran as gate tax
- `task-180-planning-sse-fallback-front-only-kata-out-of-frame.md` — Planejar o fallback REST do telão foi 100% front: kata nunca entrou em quadro
- `task-180-review-front-only-verify-as-contract-proof-not-coverage.md` — Task #180 review: front-only PR, `kata verify` proved the contract, not the fix
- `task-181-implementing-blockly-only-zero-docs-lookups.md` — Task #181 implementing: correção inteira em Blockly, kata só como gate
- `task-184-implementing-clean-verify-hurl-run-zero-docs-lookups.md` — Clean kata verify + hurl run, zero docs-mcp lookups
- `task-184-planning-ranking-filter-kata-out-of-frame-gh-issue-view-blank.md` — Planejamento da #184 não encostou no kata — mas `gh issue view` devolveu vazio com exit 0
- `task-203-planning-front-only-panels-kata-out-of-frame-stale-checkout-again.md` — Planning da #203 (painéis colapsáveis do editor): kata fora de quadro, e o checkout atrasado de novo
- `task-203-review-front-only-panels-kata-out-of-frame.md` — Reviewing PR #257 (#203): front-only, kata never in frame
- `task-215-review-docs-only-design-identity-kata-out-of-frame.md` — Review da #215 (PR #224): PR só de docs/assets de design — kata fora de quadro, zero consultas
- `task-216-implementing-front-only-kata-passive-machine-oom.md` — Fundação da identidade (#216): kata ficou inteiramente fora do caminho
- `task-216-planning-front-foundation-kata-out-of-frame-mcp-absent.md` — Planning da #216 (fundação da identidade no front): kata fora de quadro e MCP ausente da sessão
- `task-216-review-front-only-verify-was-the-only-back-signal.md` — Review da #216: kata fora do caminho, e `kata verify` foi o único sinal do `back/`
- `task-217-review-front-only-header-footer-kata-out-of-frame.md` — Task #217 (review): header/rodapé é 100% front, kata nunca entrou em quadro
- `task-225-implementing-docs-only-kata-out-of-frame-but-pre-commit-pays-full-price.md` — Task docs-only: kata fora de quadro, mas o pre-commit cobra a conta inteira
- `task-225-planning-docs-only-tokens-kata-out-of-frame.md` — Planejamento da #225 (saneamento de tokens): kata fora de quadro, zero consultas ao kata-docs
- `task-225-review-kata-out-of-frame-verify-fast-cost-is-the-vitest-ladder.md` — Review docs-only: kata fora de quadro de novo, e o `kata verify` é a parte barata
- `task-226-implementing-github-only-task-kata-out-of-frame.md` — Implementação da #226: task 100% GitHub — kata fora de quadro, e a gate ladder corretamente silenciosa
- `task-226-planning-issue-body-editing-zero-code-kata-out-of-frame.md` — Planejamento da #226: task sem código (só corpos de issue) — kata fora de quadro, zero consultas
- `task-227-implementing-design-assets-only-kata-verify-was-pure-toll.md` — Implementação da #227: nada de kata no caminho, mas `kata verify` rodou 8 vezes
- `task-227-planning-logo-geometry-kata-out-of-frame-mcp-not-consulted.md` — Planejamento da #227 (gerador do logo e vão do símbolo): kata fora de quadro, zero consultas ao kata-docs
- `task-227-review-design-docs-only-verify-as-pure-regression.md` — Design-docs-only PR: `kata verify` ran as pure regression, zero docs lookups
- `task-228-implementing-docs-only-kata-out-of-frame-hook-ladder-oomed.md` — Implementação docs-only: kata fora de quadro, mas a escada de gates do hook derrubou a máquina duas vezes
- `task-228-planning-design-spec-only-kata-out-of-frame.md` — Planejamento da #228 (completar identity.md e o canvas): kata fora de quadro, zero consultas ao kata-docs
- `task-228-review-docs-only-kata-out-of-frame-docker-network-pool-exhausted.md` — Review docs-only: kata fora de quadro de novo, e o pool de redes do Docker esgotado por worktrees mortas
- `task-229-implementing-front-and-design-only-kata-out-of-frame.md` — kata out of frame: #229 was front + design-canvas only
- `task-229-planning-front-only-round-screen-kata-out-of-frame.md` — Planning da #229 (tela da rodada na nova identidade): kata fora de quadro, MCP não consultado
- `task-229-review-front-and-design-only-kata-out-of-frame.md` — kata out of frame: review of #229/PR #253 was front + design-canvas only
- `task-230-implementing-front-only-kata-out-of-frame.md` — Task #230 (implementing): front-only, kata out of frame
- `task-230-planning-global-shells-front-only-kata-out-of-frame.md` — Planning da #230 (cascas globais: 404, erro, og:image, manifest, lang): kata fora de quadro, MCP ausente de novo
- `task-230-review-front-only-kata-out-of-frame-verify-plus-full-back-suite.md` — Task #230 (review): kata fora de quadro; `kata verify` + suíte completa do back rodaram mesmo assim
- `task-231-review-verify-and-hurl-clean-no-new-signal.md` — kata verify/hurl behaved cleanly on review of #231 — no new signal
- `task-232-implementing-sse-heartbeat-recheck-zero-docs-lookups.md` — SSE mid-stream deactivation fix: zero kata-docs lookups, verify blind to the streaming path
- `task-238-review-verify-and-hurl-clean-second-nullable-backfill-notnull-pass.md` — kata verify/hurl clean on the second nullable→backfill→NOT NULL migration (#238)
- `task-251-implementing-pure-front-e2e-spec-kata-out-of-frame.md` — Pure front e2e spec fix — kata never came into frame
- `task-251-review-pure-front-e2e-fix-kata-out-of-frame.md` — Reviewing a pure front e2e spec fix — kata never came into frame
- `task-261-implementing-docs-only-kata-out-of-frame.md` — Task #261 (implementing) — kata out of frame, docs-only change
- `task-261-review-docs-only-kata-out-of-frame-verify-green-without-db.md` — Task #261 (review): docs-only PR, kata fora de quadro — `verify` verde sem banco sustentou pular o `pnpm -r test` do back
- `task-53-planning-route-removal-zero-docs-lookups.md` — Planning a route *removal* needed zero kata-docs lookups
- `task-54-new-module-zero-docs-lookups-and-hurl-reset-cost.md` — A whole new kata module added with zero kata-docs lookups — and the hurl reset tax again
- `task-97-env-parse-error-zero-docs-lookups.md` — Env-validation error shape is app-land; kata's only role was the gate ladder
- `verify-clean-on-compose-db-port-task-96.md` — kata verify clean on an infra/docs-only task (#96)
- `verify-clean-on-deploy-infra-task-62.md` — kata verify clean on a deploy/infra task (#62), db:migrate + db:seed exercised for real
- `verify-clean-on-front-only-login-task.md` — kata verify clean on a front-only task with zero back diff (#191)
- `verify-clean-on-front-only-panels-task-203.md` — kata verify clean on a front-only task that never touched back (#203)
- `verify-clean-on-front-task-but-hook-ladder-eats-e2e-fixtures.md` — kata verify stayed free; the hook ladder around it destroyed the E2E fixtures twice
- `verify-clean-on-home-round-results-task-104.md` — kata verify stayed clean on another front-only task; zero kata-docs lookups needed
- `verify-clean-on-hosting-adr-spike-61.md` — kata verify clean on a docs-only ADR spike (#61)
- `verify-clean-on-judge-flaky-test-review-127.md` — kata verify clean reviewing a test-only flaky-timing fix (#120, PR #127)
- `verify-clean-on-leaderboard-review-fix-round2.md` — kata verify clean across a third review-driven bug fix on #45's PR
- `verify-clean-on-leaderboard-review-fix.md` — kata verify clean across a review-driven bug fix on #45's PR
- `verify-clean-on-mandatory-fk-refactor.md` — Clean kata verify run on a NOT NULL + FK-restrict refactor
- `verify-clean-on-organizer-rounds-front-task.md` — kata verify stayed free on another front-only task; zero kata-docs lookups needed
- `verify-clean-on-sse-debounce-task.md` — kata verify clean end-to-end on a debounce/pub-sub back task (#44)
- `verify-clean-review-108.md` — kata verify / hurl clean on review of PR #108 (#44)
- `verify-clean-review-266-teams-tx.md` — kata verify / hurl clean on review of PR #266 (#192)
