# Planejamento da #227 (gerador do logo e vão do símbolo): kata fora de quadro, zero consultas ao kata-docs

**Found while**: `/planning-tasks #227` — tornar `make_logo.py` executável,
corrigir o vão do símbolo que renderiza 0 px até 64 px, desduplicar a geometria
e impedir que `shot.mjs` commite PNGs com a fonte errada.
**Where in kata**: nenhum ponto — a sessão não tocou kata.

## What

Observação, sem bug. A #227 é `stack:front` no rótulo mas é inteiramente
`docs/design/`: Python de geração, SVG/PNG, um `.mjs` de screenshot e markdown.
Nenhuma rota, schema, DI, `kata verify` ou hurl entra no quadro. **Zero consultas
ao `kata-docs` MCP**, e outra vez a decisão foi imediata — não havia pergunta que
o kata pudesse responder.

O que resolveu o planejamento foi medição local, não documentação de lugar
nenhum: `rsvg-convert` + Pillow para ler a linha central dos PNGs em vários
tamanhos. Isso produziu o achado que mudou o plano — **o conserto prescrito no
corpo da issue (vão 4/64) não passa no acceptance da própria issue**: mede alfa
144/255 nas duas colunas centrais em 16 px, ou seja, continua sem pixel de fundo.
Só a partir de 8/64 aparece fundo de verdade. Uma issue escrita com muito
cuidado, por uma auditoria que inspecionou pixel, ainda assim prescreveu um
número que não fecha — porque quem escreveu mediu o *bug* mas não mediu o
*conserto*.

Segundo achado do mesmo tipo, esse contra mim: ao oferecer as opções de
geometria eu calculei a pegada da marca de cabeça e errei nos dois casos
(disse 43,5 e 49,5 de largura; o medido é 51 e 57). Os previews mostrados eram
renders reais, então a imagem estava certa e a justificativa não. Só apareceu
porque fui medir a bounding box antes da rodada seguinte de perguntas. Padrão
reutilizável: **em task de geometria, nenhum número entra numa pergunta ao
usuário sem sair de uma medição**, inclusive os que parecem aritmética trivial.

## Why it matters

Mesmo sinal de calibragem já registrado nas #215/#225/#226: um pedaço grande do
backlog do kumite (o epic #214 inteiro) não encosta no kata. Contar estas
sessões evita ler o silêncio do `kata-feedback/` como "o kata não deu problema"
quando é "o kata não estava no caminho".

## Metrics

- Consultas ao `kata-docs` MCP: **0**. Docs lidos: 0. Custo em tokens: 0.
- Custo de contexto do planejamento: corpo das #227 e #216, `identity.md` (parcial),
  `make_logo.py`, `common.py` (trecho), `shot.mjs`, `export.sh`, os quatro READMEs
  de `docs/design/` e o `CHANGELOG` — mais ~6 rodadas de script ad-hoc de medição
  (render + leitura de pixel + bounding box + conversão WOFF2).
- Atrito real da sessão, **nada disso do kata**: `api.github.com` deu
  `i/o timeout` / `TLS handshake timeout` em ~6 chamadas seguidas de `gh`,
  incluindo o `gh issue view --comments` inicial (o GraphQL falhou onde o REST
  passou — vale preferir `gh api repos/.../issues/N` quando a rede está ruim).
  Já é o padrão registrado em memória para este repo.
- O `kata-docs` MCP ajudou nesta task? Não se aplica — não foi acionado.

## Suggested fix

Nenhum para o kata. Para o kumite, o plano já cria a guarda que faltava
(`check_mark.py` chamado pelo `export.sh`): o vão zerado passou por um PR porque
nada media o artefato derivado. Vale como padrão — todo asset gerado que tem um
critério visual verificável deveria ter o verificador pendurado no próprio script
de geração, não na revisão humana.
