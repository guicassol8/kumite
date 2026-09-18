# Planejamento da #225 (saneamento de tokens): kata fora de quadro, zero consultas ao kata-docs

**Found while**: `/planning-tasks #225` — sanear `docs/design/tokens/*` e `identity.md`
(paridade oklch↔hex, gamut sRGB, anel de foco, pares abaixo de AA).
**Where in kata**: nenhum ponto — a sessão não tocou kata.

## What

Observação, sem bug. A #225 é `stack:front` mas na prática é docs-only:
mexe só em `docs/design/`. Nenhuma superfície do kata entra no quadro —
sem rota, sem schema, sem DI, sem `kata verify`, sem hurl. **Zero consultas
ao `kata-docs` MCP**, e a decisão de não consultar foi imediata, não uma
economia forçada: não havia pergunta que o kata pudesse responder.

O que resolveu o planejamento foi ferramenta local do próprio repo:
`docs/design/canvas/generate/oklch.py` para reconferir os 6 `oklch()`
divergentes e os 5 fora do gamut, e um script ad-hoc de contraste WCAG
para medir os 22 pares. Os números do corpo da issue conferiram, com uma
exceção: o corpo afirma "#F45246 dá 5,71:1 sobre #1C1716" — 5,71 é sobre
`#0E0C0B` (chrome do escuro); sobre `#1C1716` são 5,19. Ambos passam AA,
então a decisão não muda, mas é um número copiado de um contexto para
outro — o mesmo tipo de drift que a issue existe para corrigir.

Detalhe reutilizável: `oklch.py` lê `sys.stdin` no nível do módulo, então
**importá-lo trava**. Custou um comando de 120s até o timeout antes de eu
copiar a função em vez de importar. O `check_tokens.py` que o plano cria
vai copiar a conversão pelo mesmo motivo — vale saber que a origem do
problema é o script ser um filtro de linha de comando, não um módulo.

## Why it matters

Sinal de calibragem para a regra do `AGENTS.md`: uma fatia real do backlog
do kumite (todo o epic de redesign #214, e dentro dele #215, #225–#230)
não encosta no kata. Contar essas sessões evita ler o silêncio do
`kata-feedback/` como "o kata não deu problema" quando na verdade é "o
kata não estava no caminho".

## Metrics

- Consultas ao `kata-docs` MCP: **0**. Docs lidos: 0. Custo em tokens: 0.
- Custo de contexto do planejamento: `docs/design/identity.md` (215 linhas),
  `tokens.css` (113), `kumite.tokens.json` (191), `CHANGELOG.md`, corpo das
  issues #214/#225 — mais um SVG de lockup lido inteiro por engano (~6k
  tokens de `path` desnecessário; um `grep` teria bastado).
- Atrito real da sessão, **nada disso do kata**: (a) `api.github.com` deu
  `i/o timeout` em ~8 chamadas seguidas de `gh`, custando 2 comandos em
  background e ~5 minutos até a rede voltar; (b) o import de `oklch.py`
  travou até o timeout de 120s.
- O `kata-docs` MCP ajudou nesta task? Não se aplica — não foi acionado.

## Suggested fix

Nenhum para o kata. Se algum dia o `kata-docs` ganhar telemetria de uso,
sessões docs-only como esta são o denominador honesto: a conta que importa
é consultas úteis / tasks que *poderiam* ter consultado, não por task.
