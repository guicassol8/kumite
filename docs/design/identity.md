# kumite — identidade visual (v1, 2026-09-10)

Fonte da verdade da marca e da interface do kumite (epic de implementação: #214). Decidida com o organizador
em 2026-09-10 (sessão de design; canvas navegável em `canvas/`, ver
`README.md`). Mudanças aqui passam por PR e ganham entrada no `CHANGELOG.md`.

## 1. Conceito — dojo moderno

**kumite** (組手) é a luta de treino do karatê: dois praticantes, regras, um
tatame. A marca traduz isso sem ilustrar karatê: **foco, disciplina e duelo**,
calma na base e intensidade só nos momentos de competição (timer, submissão,
placar). Referências de tom: precisão de Linear/Vercel no chrome da interface;
energia de pôster esportivo nos títulos, no placar e no telão.

O que a marca **não** é: clichê de código (chaves, `</>`, binário), karatê
literal (punho, faixa, kimono, lutador), mascote ou cartoon, neon/glow gamer.

## 2. Símbolo e wordmark

**"Dois blocos em guarda."** Duas silhuetas de bloco idênticas — aba em cima,
encaixe embaixo, como um bloco do editor — giradas 180° uma em relação à
outra, frente a frente, separadas por um vão de 4/64. Elas encaixariam; não
encaixam. É o instante antes do primeiro movimento. Duas universidades, uma
disputa.

- O bloco **vermelho é sempre o da esquerda**; o da direita toma a cor do texto
  do fundo (tinta no claro, papel no escuro).
- Construção em grade 64×64, cantos de raio 3 (via stroke-linejoin round), sem
  contorno, sem sombra, sem gradiente. Nunca girar, espelhar, separar as cores
  ou colocar sobre foto sem uma placa de cor sólida atrás.
- Tamanhos mínimos: 16 px (favicon), 24 px no header, 32 px em avatar.
- Wordmark: **kumite**, sempre minúsculo, Barlow Condensed 600, tracking −1%,
  contornado em `logo/kumite-wordmark.svg` (não depende da fonte instalada).
- Lockups: horizontal (símbolo 64 · vão 20 · wordmark 55 px) e empilhado.
  Arquivos e regras de uso em `logo/README.md`.
- O símbolo em `logo/` é o vetor canônico. Os prompts em `logo-prompts.md`
  servem para explorar alternativas; um resultado melhor substitui o SVG
  mantendo a `viewBox 0 0 64 64`.

## 3. Paleta — vermelho faixa + carvão (variante A · Hinomaru)

Vermilion quente, tinta sumi e papel levemente quente. Todos os valores em
`tokens/kumite.tokens.json` (W3C DTCG) e `tokens/tokens.css` (CSS pronto para
`front/src/index.css`).

### Modo claro

| Token | Hex | oklch | Uso |
|---|---|---|---|
| background (papel) | `#FCFAF7` | 0.985 0.004 75 | fundo das telas |
| background-2 (papel 2) | `#F2F0EC` | 0.955 0.006 75 | superfícies mudas, grade do editor |
| card | `#FFFFFF` | 1 0 0 | cards, inputs, tabelas |
| border | `#E1DDDA` | 0.90 0.006 60 | hairlines de 1 px |
| muted-foreground | `#69615D` | 0.50 0.012 50 | texto secundário |
| foreground (tinta) | `#1C1716` | 0.21 0.008 40 | texto, botão primário, chrome |
| brand (vermelho faixa) | `#DD2824` | 0.58 0.215 28 | preenchimento: Submeter, Abrir rodada, badge "Seu time", símbolo |
| brand-text | `#DD2824` | = brand | texto: ao vivo, timer, #1 |
| brand-hover | `#CE2320` | 0.55 0.205 28 | hover/pressed |
| brand-soft | `#FBE5E1` | 0.95 0.025 28 | linha do seu time, anel de foco |
| destructive (crimson) | `#C1133A` | 0.52 0.200 18 | erro e ação destrutiva — só contorno e texto |
| success | `#008433` | 0.53 0.160 150 | caso passou, publicado |
| warning | `#ECAA0B` | 0.78 0.160 80 | só ícone, borda e preenchimento — nunca texto |
| warning-text | `#A06700` | 0.56 0.130 75 | "Médio", avisos em texto |
| chrome | `#1C1716` | = tinta | header e rodapé |
| chrome-foreground | `#F3F1EF` | 0.96 0.004 75 | texto do chrome |
| chrome-muted | `#9D9792` | 0.68 0.010 60 | texto secundário do chrome |
| chrome-border | `#312D2C` | 0.30 0.006 40 | bordas dentro do chrome |

### Modo escuro (`.dark`)

| Token | Hex | Uso |
|---|---|---|
| background | `#120F0D` | fundo |
| card / background-2 | `#1B1716` | cards, inputs, grade do editor |
| border | `#312D2C` | hairlines |
| muted-foreground | `#9D9792` | texto secundário |
| foreground | `#F3F1EF` | texto; botão primário vira papel com texto tinta |
| brand | `#DD2824` | preenchimentos (mesmo do claro) |
| brand-text | `#F45246` | texto, timer, ao vivo sobre o fundo escuro |
| brand-soft | `#3A1A18` | linha do seu time |
| destructive | `#E8496A` | erro |
| success | `#3DBA6A` | ok |
| warning / warning-text | `#F5C044` | aviso (no escuro passa como texto) |
| chrome | `#0E0C0B` | header e rodapé, um passo mais escuro que o fundo |

### Regras do vermelho

1. **Marca é preenchimento, erro é contorno.** Vermelho faixa (matiz 28°) e
   crimson (18°) nunca recebem o mesmo tratamento: `Submeter` é sólido
   vermelho; `Sair do time` é contorno crimson; um alerta de erro é cartão com
   borda crimson, ícone e texto — nunca uma placa vermelha.
2. **Um botão vermelho por tela**, o da ação competitiva (Submeter, Abrir
   rodada, Publicar, Ver rodada). O botão primário comum é tinta.
3. Vermelho como texto só em: chip "ao vivo", contagem regressiva, numeral do
   #1, o × de "PUCRS × Mérida". No escuro, texto usa `brand-text` (#F45246).
4. Âmbar nunca é texto no claro (1,95:1). Para texto, `warning-text`.

### Contraste (WCAG 2.x, calculado)

| Par | Razão | Nível |
|---|---|---|
| tinta sobre papel | 17,0 | AAA |
| cinza texto sobre papel / cartão | 5,8 / 6,1 | AA |
| branco sobre vermelho faixa (botão) | 4,8 | AA |
| vermelho faixa como texto sobre papel | 4,6 | AA |
| crimson sobre papel | 5,9 | AA |
| verde sobre papel | 4,6 | AA |
| âmbar-texto sobre papel | 4,6 | AA (âmbar vivo: 1,95, só ícone) |
| tinta sobre vermelho-suave | 14,7 | AAA |
| chrome-muted sobre chrome | 6,2 | AA |
| escuro: papel-texto sobre fundo | 17,0 | AAA |
| escuro: brand-text sobre fundo | 5,6 | AA |
| escuro: crimson / verde / âmbar sobre fundo | 5,1 / 7,7 / 11,4 | AA / AAA / AAA |
| texto branco sobre cada bloco do editor | 4,6–5,2 | AA |
| texto papel sobre o bloco resolver | 13,4 | AAA |

Bordas e ícones decorativos precisam de 3:1 e passam em todos os pares acima.

### Alternativas descartadas (registro)

B · Faixa preta (crimson `#D40237` + grafite `#13161B`): mais Linear, menos
pôster, crimson perto demais do vermelho de erro. C · Brasa (`#EC4800` +
carvão neutro + âmbar): mais festivo, lê como laranja. Ambas no canvas, prancha
02, para comparação.

## 4. Tipografia

Uma superfamília, três papéis. Todas gratuitas (Google Fonts / Fontsource) —
no front devem ser servidas do bundle (`@fontsource/*`), nunca por
`fonts.googleapis.com`.

| Papel | Fonte | Peso | Tamanho / entrelinha | Uso |
|---|---|---|---|---|
| Display · telão | Barlow Condensed | 800 | 84 / 76, caixa-alta, tracking +1% | título do telão, contagem regressiva |
| H1 · página | Barlow Condensed | 700 | 36 / 36, caixa-alta, tracking +1% | "PLACAR", "TIMES", "ÁREA DO ORGANIZADOR" |
| Stat | Barlow Condensed | 700 | 44 / 44, tabular | números da visão geral, timer |
| H2 · card, problema | Barlow Condensed | 600 | 24 / 26 | título de card, nome do problema |
| H3 | Barlow Condensed | 600 | 19 / 22 | seções de card |
| Eyebrow · rótulo | Barlow Condensed | 600 | 13, caixa-alta, tracking +12%, cinza | "CASOS DE EXEMPLO", cabeçalhos de tabela |
| Corpo | Barlow | 400 | 15 / 22 (14 em tabelas) | enunciados, formulários |
| UI | Barlow | 500 | 14 | botões, rótulos, navegação |
| Small | Barlow | 400 | 13 | texto secundário |
| Mono | JetBrains Mono | 400 | 13 / 20 | JSON, casos de teste, códigos de evento |

Números do placar, pontos e timer: sempre `font-variant-numeric: tabular-nums`.
Caixa-alta é aplicada por CSS (`text-transform`), nunca digitada nos catálogos
i18n. O wordmark é Barlow Condensed 600 minúsculo, tracking −1%.

## 5. Interface

- **Chrome carvão nos dois modos**: header (56 px) e rodapé em `chrome`,
  lockup à esquerda, navegação, chip da rodada ao vivo (nome + timer),
  usuário, Sair em contorno claro, idioma como controle segmentado, botão de
  tema. No celular: lockup + idioma + menu.
- **Modo de cor**: claro por padrão; escuro completo (`.dark`), escolhido pelo
  usuário ou pelo sistema (`prefers-color-scheme`), persistido em
  `localStorage`. O telão força escuro.
- **Raio 6 px** em controles, 8 px em cards, pílula em badges. Hairlines de
  1 px, sem sombra além do anel de foco (`brand-soft`, 3 px).
- **Controles**: 36 px de altura; 44 px em telas de toque e formulários de
  autenticação. Botões: primário (tinta), marca (vermelho, um por tela),
  contorno, fantasma, destrutivo (contorno crimson).
- **Badges**: dificuldade (Fácil verde / Médio âmbar-texto / Difícil crimson,
  contorno), estado (Publicado sólido tinta, Rascunho cinza, Arquivado cinza
  riscado, Aberta com ponto vermelho, Encerrada cinza), "Seu time" (vermelho
  sólido), universidade (selo textual `PUCRS` / `Mérida` em Barlow Condensed
  caixa-alta — sem emoji de bandeira, que renderiza diferente por sistema).
- **Alertas**: cartão com borda na cor semântica + ícone + texto; erro em
  crimson, sucesso em verde, informação neutra. Nunca placa preenchida.
- **Tabelas**: cabeçalho em eyebrow, hairlines, numerais em display tabular;
  sem scroll horizontal em nenhuma largura (colunas comprimem; abaixo do
  breakpoint estreito, cards).
- **Ao vivo**: ponto vermelho + texto em eyebrow vermelho; timer em Barlow
  Condensed 600; nos últimos 5 min o timer fica em `brand-text`.
- **Ícones**: traço de 2 px em grade 24 (estilo Lucide, já usado pelo shadcn).
  Sem emoji.
- **Telão** (placar): tela cheia, tema escuro forçado, sem header/rodapé,
  título 84 px, contagem 96 px em `brand-text`, linhas ≥ 28 px, legenda A/B/C
  no rodapé, `Esc` sai.

## 6. Editor Blockly (`@kumite/blocks`)

Todas as categorias em oklch L ≈ 0,55 · C ≈ 0,13, matizes distintos (para
continuar aprendível) mas sem brigar entre si nem com o vermelho:

| Categoria | Hex | Nota |
|---|---|---|
| Lógica | `#2A75BA` | |
| Laços | `#298646` | |
| Matemática | `#6B64BA` | |
| Texto | `#008282` | |
| Listas | `#8E57A5` | |
| Variáveis | `#A76700` | sai do rosa 330°, vizinho do vermelho |
| resolver (raiz) | `#2A2523` | texto `#F3F1EF`; é o tatame — não arrastável nem apagável |
| entrada | `#DD2824` | o único bloco vermelho do canvas |

Chrome do editor nos tokens da UI: toolbox em cartão com barra de categoria de
4 px, grade de pontos em papel 2 (20 px), zoom/lixeira em círculos de 32 px,
flyout com a mesma borda. Tema escuro: mesmas cores de bloco, grade em cartão
escuro. Implementação via `Blockly.Theme.defineTheme` dentro de
`@kumite/blocks` (`blockStyles`, `categoryStyles`, `componentStyles`).

## 7. Telas de referência

PNG de cada tela em `screens/` e artboards editáveis em `canvas/`:
início, login (painel-pôster), cadastro no celular, editor claro e escuro,
times, placar, telão, painel do organizador; pranchas de símbolo, paleta,
tipografia, componentes e Blockly.

## 8. Vocabulário de aplicação

- "PUCRS × Mérida — programação em blocos" é a tagline; o × pode ir em
  vermelho em contextos de pôster.
- Nome do produto: `kumite`, minúsculo, também no meio de frase.
- Rodapé: "PUCRS × Mérida 2026" com o símbolo em 16 px.
