# Planning da #203 (painéis colapsáveis do editor): kata fora de quadro, e o checkout atrasado de novo

**Found while**: planning-tasks #203 (`/problem/$id` — enunciado e faixa de resultados colapsáveis e redimensionáveis no desktop)
**Where in kata**: nenhum módulo tocado; `kata verify` entra no plano só como degrau da gate ladder

## What

Task `stack:front` pura, e desta vez nem de longe encostou no contrato da API:
o plano tem 11 passos e todos vivem em `front/` — um primitivo do shadcn, um
shim de jsdom, um hook, um adaptador de storage, uma extração de componentes,
sete chaves i18n e uma spec do Playwright. Nenhuma pergunta sobre DI,
middleware, formato de erro, regras do `verify` ou hurl chegou a se formar.
**A kata-docs MCP não foi consultada — não por estar fora do ar, mas por não
haver o que perguntar.** É o mesmo padrão das entradas 229, 230, 216 e 228.

O que valeu a pena neste planejamento não foi documentação de framework
nenhuma: foram os **arquivos de tipo do pacote npm**. Duas decisões grandes
saíram de ler `react-resizable-panels.d.ts` direto do tarball
(`npm pack` + `tar x`), antes de escrever uma linha do plano:

1. O `shadcn add resizable` do registry **já está no v4** (`Group`/`Panel`/
   `Separator`, dep `react-resizable-panels@^4`), não na API v2 que eu teria
   escrito de memória (`PanelGroup` + `direction` + `autoSaveId`). Um plano
   escrito de cabeça teria mandado o implementador contra uma API que não
   existe mais.
2. O `Separator` do v4 **já reseta no duplo clique** por padrão
   (`disableDoubleClick` desliga) — um requisito inteiro do plano virou "só
   escrever o teste" em vez de "implementar".

## Why it matters

1. **Mais um ponto na série "fora do quadro do kata"**, pelas mesmas razões já
   registradas: o epic #214 e o backlog de bugs do front estão produzindo
   trabalho que simplesmente não passa perto do back. Para quem triar esta
   pasta: a escassez de feedback é sobre a *natureza do trabalho*, não sobre a
   qualidade do kata.
2. **O padrão "o `.d.ts` respondeu" se repete pela quinta vez** (tasks 143,
   174, 181, 203). Aqui não foi um plano B depois de a MCP falhar — foi o plano
   A, e custou 3 tool calls. Vale como observação para o kata: tipos publicados
   e comentados são a documentação que sobrevive a estar offline, a estar
   desatualizada e a mudar de major. O `.d.ts` do `react-resizable-panels` tem
   TSDoc em praticamente toda prop, incluindo os avisos de "essas propriedades
   CSS não podem ser sobrescritas" — que foi exatamente o que decidiu a
   arquitetura md↔celular do plano.

## Metrics

- Consultas à kata-docs MCP: **0**. Docs do kata lidos: 0. Turnos gastos com
  kata: 0. Tokens gastos em kata: 0 de ~150k da sessão de planejamento.
- Custo de responder as duas perguntas decisivas de API: **3 tool calls**
  (`npm pack` do pacote + 2 `grep`/`sed` no `.d.ts`) + 1 `curl` no registry do
  shadcn. Pagou-se sozinho: evitou um plano inteiro escrito contra a API v2.
- Fricção real da sessão, **não** atribuível ao kata, duas ocorrências:
  - `gh issue view 203 --comments` devolveu **saída vazia com exit 0** na
    primeira chamada. Mesma falha silenciosa já registrada na entrada da #229;
    o retry com `--json` trouxe tudo. Custo: 1 tool call.
  - **O checkout principal estava 9 commits atrás de `origin/develop`** — e
    três deles mexiam em insumos diretos do plano (`useWorkspaceAutoSave` virou
    por-usuário no #248, a identidade e o modo escuro entraram no #249/#256,
    e o #252 trouxe um teste de paridade de tokens). O plano foi postado antes
    de eu perceber e teve que ser **revisado e reeditado**. Custo: ~8 tool calls
    e uma revisão pública do comentário.

    É a **segunda ocorrência registrada** do mesmo problema nesta pasta — a
    entrada da #229 já tinha fechado com exatamente esta recomendação. Duas
    vezes seguidas deixa de ser azar.

## Suggested fix (optional)

Nada no kata. Para quem mantém o kumite: o Step 1 do skill `planning-tasks`
manda absorver a issue e explorar o código, mas **não manda sincronizar o
checkout**. A entrada da #229 sugeriu isso; a #203 tropeçou de novo. Vale
promover a recomendação a passo literal — um `git fetch origin` seguido de
`git rev-list --left-right --count HEAD...origin/develop` como primeira linha
do Step 1, e ler o código por `git show origin/develop:<path>` quando o
checkout estiver atrás. Custo: um comando. Evitado: planejar contra um mundo
que não existe mais, duas vezes em quatro tasks.
