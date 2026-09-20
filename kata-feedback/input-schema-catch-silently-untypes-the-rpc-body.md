# `.catch()` in an input schema silently untypes the RPC request body

**Found while**: planning kumite #194 (truncating `context.userAgent` before
`POST /bug-reports`, whose schema caps every context field at 500 chars)
**Where in kata**: `KataToHonoInput` in `dist/context-CHM92emD.d.ts:176-183`;
the `kata verify` rule registry in `dist/src-UCVUEMQP.js:1662-1676`
(`@katajs-framework/core@0.4.2`)

## What

The plan had to answer one question before choosing between "truncate on the
client" and "make the server truncate instead of rejecting": does a zod
transform in an `input.body` schema break `hc<AppType>`?

The answer is good, and is documented only as a JSDoc line on an internal
type: the request side of the generated `AppType` is `z.input`, while the
response side is `z.infer`. So `z.string().max(500).transform((s) =>
s.slice(0, 500))` keeps `$post({ json })` accepting the untransformed string,
and the handler still receives the transformed one via `c.input.body`
(`Infer<T> = z.infer<T>`). That is exactly the behaviour a consumer wants.

The sharp edge is the neighbouring combinator. `ZodCatch` is declared with
`Input = unknown` (`zod/v3/types.d.ts:864`), so `z.string().catch('x')` inside
a body object makes that json property **`unknown` *and* optional** on the
client — `addQuestionMarks` marks a key optional whenever `undefined extends
T[k]`, and `undefined extends unknown` holds. A `.catch()` on the whole body
object makes the entire `json` argument `unknown`. Either way every bit of
client-side type checking for that field disappears with no error anywhere.

Nothing in `kata verify` notices. The 13 rules were grepped for
`transform|\.catch|ZodEffects|effects|refine|preprocess|pipe\(` and the only
hit is an unrelated promise `.catch()` in the CLI. The two rules that come
closest do not look at schema shape at all:
`kata/no-route-without-input-schema` only checks that the `defineRoute` object
literal *has* an `input` key, and `kata/inline-schema` keys on the `z.` root
call being outside a `*.schema.ts`, not on what is chained after it.
`--strict-coverage` changes nothing here (it only promotes suppressed
`scoped-slot-not-provided` checks to exit 1).

## Why it matters

"Accept anything, store something bounded" is the natural shape for exactly
the kind of field kumite has here: an unverified, client-supplied diagnostic
blob that must never be the reason a real bug report is rejected. A consumer
reaching for that shape has a 50/50 choice between `.transform()` (works, and
keeps the client honest) and `.catch()` (works at runtime, and silently
deletes the client's type safety for that field). Neither the types nor
`kata verify` distinguishes them, and the failure is invisible: the front keeps
compiling, and the field it no longer checks is the one whose whole purpose is
to arrive well-formed.

The request-`z.input` / response-`z.infer` asymmetry is itself worth
documenting outside a `.d.ts` comment. kumite has already been bitten by the
output half of it twice (`v2/hc-client-date-typed-as-date-but-wire-is-string.md`,
`v2/hc-date-typing-lie-ten-workarounds-later.md`).

## Metrics

kata-docs MCP disabled and `~/Projetos/kata/docs` absent in this session, so
the answer came from reading the bundled `.d.ts` and `dist/` of
`@katajs-framework/core@0.4.2` — 1 delegated research pass, ~28 tool calls,
~70k tokens, ~3.5 min, entirely inside the planning phase. It paid for itself:
it turned a guess into a costed option in the plan (a back-side `.transform()`
is type-safe; the plan can recommend against it for scope reasons rather than
for fear of breaking the contract). 0 `kata verify` runs (planning writes no
code), 0 friction turns.

## Suggested fix

1. A `kata verify` rule — `kata/no-catch-in-input-schema` — flagging
   `.catch()` and `.default()`-on-required anywhere under a route's `input`
   schemas, with the message naming the consequence ("the RPC client will type
   this field as optional `unknown`"). `.transform()` and `.refine()` stay
   allowed.
2. One paragraph in the docs, next to the `hc<AppType>` section: request uses
   `z.input`, response uses `z.infer`, here is what each combinator does to the
   client's argument type (`transform` → inner input, `catch` → `unknown`,
   `default`/`optional` → `| undefined`, `pipe` → `A['_input']`).
