# Planejar a remontagem do editor foi 100% front — kata fora de quadro, e o
# atrito da sessão inteira foi o GraphQL do `gh`, não o framework

**Found while**: planejamento do #178 (trocar de idioma em `/problem/$id`
desmonta a subárvore do editor e a re-semeia com o estado do carregamento da
página — achados #5 e #39 do diagnóstico de 2026-09-10).

**Where in kata**: nenhum ponto de contato. **Zero** consultas ao `kata-docs`
MCP, zero `kata verify`, zero hurl, zero leitura de arquivo sob `back/`. O
plano inteiro vive em `front/`: `routes/problem.$id.tsx`,
`hooks/use-workspace-autosave.ts`, `hooks/use-blockly-locale.ts`,
`components/blockly/blockly-workspace.tsx`, `lib/workspace-storage.ts`,
`lib/problems-query.ts` e os specs correspondentes.

## What

Observação, sem bug. A causa do #178 é de React puro — chave de query que
inclui o locale (`[...problemQueryKey(id), locale]`) fazendo `isPending` virar
`true` num early-return posicionado acima do editor, somado a um
`useState(() => load(...))` congelado no primeiro render. Nada disso toca o
kata: o back só aparece como produtor do JSON traduzido, através de um
`GET /problems/:id?locale=` que o front já consome há várias tasks.

Registro mesmo assim porque a convenção pede tentativa em todo planejamento, e
porque a ausência **também** é sinal: das últimas tasks planejadas, a maioria
não encosta no framework. O `kata-docs` só paga quando a dúvida é de
superfície do kata (DI, middleware, `output`, códigos de erro); em task de
front ele é overhead puro, e o custo certo de consultá-lo é zero.

O único lugar onde o kata entrou de raspão foi **de leitura**, e sem gerar
dúvida: `fetchProblem` (`front/src/lib/problems-query.ts:18`) já carrega o
`(res.status as number) === 422` com o comentário explicando que 422 é o
envelope de validação do kata e que nenhuma rota o declara em `output`. Ou
seja: a quina conhecida já está **domada e documentada no ponto de uso**, e por
isso não custou nada desta vez. É o desfecho bom do padrão registrado três
vezes nas tasks anteriores (422, 401, e o custo de plano do #179) — quando o
comentário está na linha do consumidor, o próximo agente não tropeça.

## Why it matters

Nada a mudar no kata. Duas coisas que valem como sinal agregado:

1. A fricção "status de middleware invisível no tipo do `hc`" não reapareceu
   **porque o kumite já a comentou no ponto de uso**. Mitigação por comentário
   local funciona; continua não sendo descoberta pelo `kata-docs`.
2. O custo real desta sessão não veio do framework nem do MCP: veio da rede do
   `gh` (abaixo). Se houver orçamento de melhoria de harness, é lá que ele
   rende, não em documentação do kata.

## Metrics

- Consultas ao `kata-docs` MCP: **0**. Documentos lidos: **0**. Tokens gastos
  em round-trip ao MCP: **0**. Teria ajudado? **Não** — o plano não tem
  nenhuma pergunta respondível por ele.
- Custo total do planejamento: ~14 chamadas de ferramenta, quase todas leituras
  locais (`cat -n`, `grep`, `find`), mais as chamadas ao `gh`. Uma única rodada
  de `AskUserQuestion` com **4 perguntas** (alcance da desmontagem, origem do
  estado de re-semeadura, indicador visual durante a troca, estratégia de
  prova) — todas de produto/arquitetura de front, **nenhuma** de framework. As
  quatro recomendações foram aceitas.
- Atrito de ambiente, **não-kata**, pior do que nas sessões anteriores: **todo**
  comando `gh` que passa por GraphQL falhou (`gh issue view --comments` em ~6
  tentativas, `gh issue comment` em 3) com
  `Post "https://api.github.com/graphql": dial tcp ...: i/o timeout`, enquanto
  a **REST respondia de primeira** — `gh api repos/<owner>/<repo>/issues/178`,
  `.../comments` e `.../issues?state=open` funcionaram todos sem retry. O plano
  foi postado por `gh api ... -f body="$(cat ...)"`. Custo: ~6 chamadas de
  ferramenta desperdiçadas.
- Duas armadilhas de harness observadas de passagem, ambas com **falha muda**:
  `gh issue view` saiu uma vez **vazia com exit 0** (nem erro nem conteúdo), e
  um retry escrito como `for i in 1 2 3; do gh ... && break; sleep 3; done`
  morreu no 1º `sleep` sem imprimir nada, porque `sleep` em foreground é
  bloqueado pelo harness. Nenhuma das duas é do kata, mas as duas custam turnos
  e ambas se parecem com "o comando não existe" para quem não conhece.

## Suggested fix (optional)

Nada para o kata. Para o harness/ambiente, se alguém triar: quando o GraphQL do
`gh` está fora e a REST não está, o caminho que funciona é `gh api` cru — vale
uma linha em `AGENTS.md` ou nas convenções de sessão, porque hoje cada agente
redescobre isso gastando meia dúzia de retries.
