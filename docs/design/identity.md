# kumite — identidade visual (v1, 2026-09-10)

A spec da marca e da interface do kumite (epic de implementação: #214):
manda no que as telas fazem e cita **tokens**; quem manda nos **valores** é
`tokens/kumite.tokens.json`. Decidida com o organizador em 2026-09-10
(sessão de design; canvas navegável em `canvas/`, ver `README.md`). Mudanças
aqui passam por PR e ganham entrada no `CHANGELOG.md`.

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
outra, frente a frente, separadas por um vão de 8/64. Elas encaixariam; não
encaixam. É o instante antes do primeiro movimento. Duas universidades, uma
disputa.

- O bloco **vermelho é sempre o da esquerda**; o da direita toma a cor do texto
  do fundo (tinta no claro, papel no escuro).
- Construção em grade 64×64: borda externa do bloco em **6,5**, borda interna
  em **26,5**, cantos de raio 3 via `stroke-linejoin: round` com
  `stroke-width: 3`. Sem contorno, sem sombra, sem gradiente. Nunca girar,
  espelhar, separar as cores ou colocar sobre foto sem uma placa de cor sólida
  atrás.
- **O stroke faz parte da conta do vão.** `stroke-width: 3` infla o path em 1,5
  unidade para cada lado: os blocos vão de 5,0 a 28,0 e o vão renderizado é
  64 − 2×28 = **8 unidades**. Mexer nas bordas ou na largura do stroke sem
  refazer essa conta é como a v1 acabou com vão de 4/64 na spec e 1/64 na tela
  (#227). A geometria mora em `canvas/generate/mark.py`, num lugar só, e
  `canvas/generate/check_mark.py` mede o resultado nos PNGs.
- Tamanhos mínimos: 16 px (favicon), 24 px no header, 32 px em avatar. O vão
  sobrevive a todos eles — medido nos PNGs exportados, não no SVG:

  | Tamanho | Vão renderizado |
  |---|---|
  | 16 px (favicon) | 2 px |
  | 24 px (header) | 2 px |
  | 32 px (avatar) | 4 px |
  | 64 px | 8 px |

  É por isso que **não existe uma variante de vão exagerado só para 16/32 px**,
  como se faz com ícone de app: a avaliação foi feita e a geometria única dá
  conta. A silhueta continua ocupando 41 das 64 unidades na vertical, então em
  16 px ela entrega uma mancha de ≈ 16 × 10 px — estreita, mas com os dois
  blocos separados, que é o que o conceito exige.
- Wordmark: **kumite**, sempre minúsculo, Barlow Condensed 600, tracking −1%,
  contornado em `logo/kumite-wordmark.svg` (não depende da fonte instalada).
- Lockups: horizontal (símbolo 64 de altura · vão 20 · wordmark em **corpo**
  55 px — é o `font-size`, não a largura; o lockup inteiro sai em 212,09 × 64)
  e empilhado. Arquivos e regras de uso em `logo/README.md`.
- Largura mínima do lockup horizontal: **96 px**. O header é a única exceção,
  e é documentada: ali o símbolo vai em 24 px, o que dá um lockup de ≈ 80 px,
  aceitável porque o contexto já nomeia o produto.
- O símbolo em `logo/` é o vetor canônico — é a marca, não um rascunho à espera
  da geração de imagem. Os prompts em `logo-prompts.md` servem para explorar
  alternativas; trocar o símbolo por um deles é **v2 da identidade**, não um
  ajuste, e segue o checklist de substituição que está lá.
- **Exceção à regra do vermelho à esquerda:** no `kumite-app-icon.svg` o
  vermelho é a **placa**, e os dois blocos são papel (esquerda) e tinta
  (direita). É a única inversão permitida, porque ali o vermelho já é a
  superfície da marca e repetir o bloco vermelho sobre ele o apagaria. Vale só
  para o ícone de app e o `apple-touch-icon`; em qualquer outro suporte a
  Regra 1 de `logo/README.md` continua valendo sem exceção.

## 3. Paleta — vermelho faixa + carvão (variante A · Hinomaru)

Vermilion quente, tinta sumi e papel levemente quente. Os valores vigentes
estão em `tokens/kumite.tokens.json` — a fonte da verdade — e derivados à mão
em `tokens/tokens.css`; as tabelas abaixo repetem o hex para leitura, e quem
implementa cita **o token**, nunca o valor. `canvas/generate/check_tokens.py`
confere os quatro arquivos que repetem esses hex: os dois de `tokens/`, a
tabela de contraste deste documento e `canvas/generate/common.py`, que desenha
as pranchas.

### Modo claro

| Token | Hex | oklch | Uso |
|---|---|---|---|
| background (papel) | `#FCFAF7` | 0.986 0.005 78 | fundo das telas |
| background-2 (papel 2) | `#F2F0EC` | 0.956 0.006 85 | superfícies mudas, grade do editor |
| card | `#FFFFFF` | 1 0 90 | cards, inputs, tabelas |
| muted | `#F2F0EC` | = papel 2 | hover de linha, linha selecionada, botão fantasma e secundário |
| border / input | `#E1DDDA` | 0.9 0.006 60 | hairlines de 1 px, borda de controle |
| muted-foreground | `#69615D` | 0.5 0.012 48 | texto secundário |
| foreground (tinta) | `#1C1716` | 0.21 0.008 31 | texto, botão primário, chrome |
| brand (vermelho faixa) | `#DD2824` | 0.58 0.215 28 | preenchimento: Submeter, Abrir rodada, badge "Seu time", símbolo |
| brand-text | `#DD2824` | = brand | texto vermelho sobre papel/cartão: #1, × do pôster |
| brand-on-chrome | `#F45246` | 0.66 0.2 28 | texto vermelho **sobre o chrome**: ao vivo, contagem regressiva |
| ring | `#DD2824` | = brand | anel de foco (borda 1 px + halo `ring/50`) |
| brand-hover | `#CE2320` | 0.55 0.205 28 | hover/pressed |
| brand-soft | `#FBE5E1` | 0.94 0.0248 30 | fundo da linha do seu time e halo — nunca o indicador de foco |
| destructive (crimson) | `#C1133A` | 0.52 0.2 18 | erro e ação destrutiva — só contorno e texto |
| success | `#008433` | 0.535 0.155 148 | caso passou, publicado |
| warning | `#ECAA0B` | 0.78 0.16 80 | só preenchimento e borda decorativa — nunca texto nem ícone sozinho |
| warning-text | `#A06700` | 0.562 0.121 72 | "Médio", avisos em texto, ícone de aviso isolado |
| chrome | `#1C1716` | = tinta | header e rodapé |
| chrome-foreground | `#F3F1EF` | 0.96 0.0034 68 | texto do chrome |
| chrome-muted | `#9D9792` | 0.68 0.01 63 | texto secundário do chrome |
| chrome-border | `#312D2C` | 0.3 0.006 34 | bordas dentro do chrome |

### Modo escuro (`.dark`)

| Token | Hex | oklch | Uso |
|---|---|---|---|
| background | `#120F0D` | 0.17 0.007 56 | fundo |
| card / background-2 | `#1B1716` | 0.21 0.007 34 | cards, inputs, grade do editor |
| muted / secondary / accent | `#282322` | 0.26 0.008 31 | superfície de estado: hover de linha, linha selecionada, botão fantasma e secundário |
| border / input | `#312D2C` | 0.3 0.006 34 | hairlines, borda de controle |
| muted-foreground | `#9D9792` | 0.68 0.01 63 | texto secundário |
| foreground | `#F3F1EF` | 0.96 0.0034 68 | texto; botão primário vira papel com texto tinta |
| brand | `#DD2824` | 0.58 0.215 28 | preenchimentos (mesmo do claro) |
| brand-text | `#F45246` | 0.66 0.2 28 | texto vermelho sobre o fundo escuro |
| brand-on-chrome | `#F45246` | = brand-text | ao vivo e contagem sobre o chrome (mesmo token nos dois modos) |
| ring | `#DD2824` | = brand | anel de foco |
| brand-soft | `#3A1A18` | 0.263 0.051 25 | fundo da linha do seu time |
| destructive | `#EF5C7B` | 0.673 0.182 10.6 | erro — claro o bastante para a variante `/90` do alerta passar AA |
| success | `#3DBA6A` | 0.7 0.1596 151.57 | ok |
| warning / warning-text | `#F5C044` | 0.834 0.148 85 | aviso (no escuro passa como texto) |
| chrome | `#0E0C0B` | 0.156 0.004 48 | header e rodapé, um passo mais escuro que o fundo |

**Hex é o valor; o oklch é anotação.** `tokens.css` declara hex porque um
`oklch()` fora do gamut sRGB só chega naquela cor por clipagem do navegador —
em tela P3 ele não clipa, e a cor passa a divergir do hex gêmeo usado nos
SVGs do logo e nos `--block-*`. Quatro tokens **encostam na superfície do
gamut** (algum canal em `00`/`FF`, isto é, sem folga de croma nenhuma):
`success` `#008433`, `warning-text` `#A06700` e os blocos `text` `#008282` e
`variables` `#A76700`. Aumentar o croma de qualquer um deles sai do gamut;
mexer neles é mexer no hex, nunca no oklch.

### Regras do vermelho

1. **Marca é preenchimento, erro é contorno.** Vermelho faixa (matiz 28°) e
   crimson (18°) nunca recebem o mesmo tratamento: `Submeter` é sólido
   vermelho; `Sair do time` é contorno crimson; um alerta de erro é cartão com
   borda crimson, ícone e texto — nunca uma placa vermelha.
2. **Um botão vermelho por tela**, o da ação competitiva (Submeter, Abrir
   rodada, Publicar, Ver rodada). O botão primário comum é tinta.
3. Vermelho como texto só em: chip "ao vivo", contagem regressiva, numeral do
   #1, o × de "PUCRS × Mérida". **O fundo decide o token**: sobre papel ou
   cartão é `brand-text` (no escuro ele já é mais claro); sobre o **chrome**,
   que é carvão nos dois modos, é `brand-on-chrome` — também nos dois modos.
   O `brand-text` do claro sobre o chrome dá 3,72:1 e reprova, e é exatamente
   ali que ficam o chip "ao vivo" e a contagem regressiva do header.
4. Âmbar vivo nunca é texto (2,0:1 sobre papel) **nem ícone sozinho**: serve
   de preenchimento e borda. Texto e ícone que carregam a informação sem
   companhia usam `warning-text`.

### Contraste (WCAG 2.x, calculado)

Recalculada par a par por `canvas/generate/check_tokens.py` a partir dos
tokens: a checagem 4 falha se uma linha aqui divergir do que os valores
rendem. `/90` é a opacidade que o shadcn aplica na descrição do `Alert`.

| Par | Razão | Nível |
|---|---|---|
| tinta sobre papel | 17,0 | AAA |
| cinza texto sobre papel / cartão | 5,8 / 6,1 | AA |
| branco sobre vermelho faixa (botão) | 4,8 | AA |
| vermelho faixa como texto sobre papel | 4,6 | AA |
| dificuldade no claro: verde / âmbar-texto / crimson sobre cartão | 4,8 / 4,7 / 6,1 | AA |
| crimson sobre papel — cheio / `/90` | 5,9 / 5,2 | AA |
| âmbar vivo sobre papel — preenchimento e borda, nunca ícone sozinho | 2,0 | decorativo |
| tinta sobre vermelho-suave (fundo de linha) | 14,7 | AAA |
| anel de foco (`ring`) sobre papel / cartão | 4,6 / 4,8 | AA |
| anel de foco (`ring`) sobre cartão escuro / superfície de estado | 3,7 / 3,3 | AA |
| `brand-on-chrome` sobre chrome claro / escuro | 5,2 / 5,7 | AA |
| chrome-muted sobre chrome | 6,1 | AA |
| escuro: papel-texto sobre fundo / cartão | 16,9 / 15,8 | AAA |
| escuro: brand-text sobre fundo / cartão | 5,6 / 5,2 | AA |
| escuro: papel-texto sobre vermelho-suave (fundo de linha) | 13,9 | AAA |
| escuro: destructive sobre cartão — cheio / `/90` | 5,5 / 4,7 | AA |
| escuro: dificuldade verde / âmbar / crimson sobre cartão | 7,1 / 10,6 / 5,5 | AA |
| escuro: texto / texto secundário sobre a superfície de estado | 13,8 / 5,4 | AA |
| escuro: cartão ↔ superfície de estado (degrau de hover/seleção) | 1,1 | decorativo |
| hairline sobre papel / cartão / cartão escuro | 1,3 / 1,3 / 1,3 | decorativo |
| borda de controle de formulário sobre papel / cartão escuro | 1,3 / 1,3 | decorativo |
| texto branco sobre cada bloco do editor (menor / maior) | 4,6 – 5,2 | AA |
| texto papel sobre o bloco resolver | 13,4 | AAA |

**O que "decorativo" quer dizer aqui.** As hairlines de 1 px e o degrau de
superfície do escuro ficam perto de 1,3:1 e **não chegam a 3:1** — por isso
nunca são a única pista de nada. O que o kumite exige em 3:1 é o **indicador
de foco** e todo **ícone que carrega uma informação sozinho**, e esses dois
estão na tabela acima (`ring`, `warning-text`). Um campo de formulário é
identificado pelo rótulo e pelo preenchimento, com a borda como reforço; e no
escuro **o estado de uma linha se lê pelo degrau `card` → `muted` mais o
hairline**, nunca só pelo fundo — se um estado precisar existir sem esses
dois, ele ganha texto, ícone ou marca de seleção.

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
| Título do telão | Barlow Condensed | 800 | 84 / 76, caixa-alta, tracking +1% | título do telão |
| Contagem do telão | Barlow Condensed | 800 | 96 / 88, tabular | contagem regressiva do telão |
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

- **Chrome carvão nos dois modos**: header (56 px) e rodapé em `chrome`. O
  inventário abaixo é a **lista fechada** do que o chrome tem — quem implementa
  (#217) constrói estes elementos e nenhum outro.

  **Header, desktop (≥ 768 px)**, da esquerda para a direita: lockup (símbolo
  24 px + wordmark); navegação (Times, Placar, Prática e, para o organizador,
  Organizador — a Prática entrou pela #211, épico #208, e aparece com ou sem
  rodada aberta); chip da rodada ao vivo (ponto + nome da rodada + timer) em
  `brand-on-chrome`; **ícone de reportar bug** — traço de 2 px em grade 24, sem
  rótulo, com nome acessível ("Reportar um problema"), abrindo o formulário de
  bug; **gatilho do menu do usuário** — nome truncado (com reticências) mais um
  chevron, que abre um dropdown com nome e e-mail no topo e **"Trocar senha"**
  como único item de ação; botão **Sair** em contorno claro; controle segmentado
  de idioma (PT · ES · EN); botão de tema. **Idioma, tema e Sair continuam
  visíveis na barra** no desktop — não migram para dentro do menu do usuário,
  que existe para o que não cabe nela.

  **Barra comprimida (768–1279 px)**, averbada pela #297. O inventário acima é
  o mesmo em toda largura de desktop — nada migra para dentro de menu nenhum —
  mas abaixo de 1280 px a barra o comprime: espaçamentos menores (gap 8 px no
  lugar de 16), padding horizontal menor nos controles, seletor de idioma como
  **um grupo segmentado de verdade** (sem folga entre PT · ES · EN) e o nome do
  usuário truncado em 80 px em vez de 200. Duas regras decorrem disso:

  - **O nome da rodada sai entre 768 e 1023 px e volta em 1024 px.** É o único
    item da barra sem largura previsível — texto livre que o organizador
    digita, com teto só na coluna de 120 caracteres —, então dimensionar a
    barra por ele seria dimensionar por uma string desconhecida. De 1024 px
    para cima ele reaparece com teto de 240 px e reticências. O **ponto e o
    timer ficam em toda largura**: o chip nunca some, e nada mais do
    inventário desaparece para a barra caber.
  - **O timer do header é o numeral**, não a frase. "Termina em 41:23" é a
    redação do cartão da home; no chip, onde a §5 descreve "ponto + nome +
    timer", o que se lê é `41:23`. A frase inteira continua sendo anunciada
    por leitor de tela (`round-countdown-summary`, `sr-only`), então a
    economia é só de pixels.

  A medida que decide tudo isto é `document.scrollWidth ≤ window.innerWidth`,
  nos três catálogos e para os dois papéis, em **768 px** (com e sem rodada
  aberta) e em **1024 px** (com rodada aberta, que é o caso que carrega o
  nome) — `front/e2e/header-width.spec.ts`. O caso que dimensiona é o
  **inglês com rodada aberta**, não o português: veja Expansão de texto,
  abaixo.

  **Header, celular (< 768 px)**: lockup + controle de idioma + botão de menu.
  O botão abre um **painel de menu** com navegação (incluindo Prática, #211),
  bloco do usuário (nome e e-mail), chip da rodada, tema, reportar bug e Sair.
  É esse painel que fecha o #186; o FAB de reportar bug não existe em largura nenhuma. O **idioma não
  entra no painel**: fica no header em toda largura, porque é a única
  preferência que precisa ser alcançável sem abrir menu nenhum — inclusive
  deslogado, por quem não consegue ler a interface no idioma em que ela abriu.

  **Rodapé**: contato da organização; **indicador de status da API** — ponto de
  8 px (`success` conectado · `destructive` sem conexão · `chrome-muted`
  conectando) **mais rótulo curto** ("Conectado", "Sem conexão", "Conectando"),
  porque a §3 proíbe cor como única pista; e símbolo de 16 px +
  "PUCRS × Mérida 2026". No celular o rodapé empilha.
- **Modo de cor**: claro e escuro completo (`.dark`). Enquanto não há escolha
  salva, o padrão segue `prefers-color-scheme` — e acompanha a troca ao vivo,
  com a aba aberta. A escolha do usuário (o toggle do header), persistida em
  `localStorage`, vence a preferência do sistema. O telão força escuro. O
  escuro é coberto por um smoke de contraste AA nas rotas principais
  (`front/e2e/dark-contrast.spec.ts`, #234).
- **Foco**: borda de 1 px em `ring` mais um halo de 3 px em `ring/50` — é o
  que os primitivos do shadcn já fazem
  (`focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50`).
  `ring` é o único token do indicador de foco; `brand-soft` é fundo de linha e
  halo, **nunca** o indicador (daria 1,2:1 sobre o cartão).
- **Raio 6 px** em controles, 8 px em cards, pílula em badges. `tokens.css`
  declara a escala inteira (`--radius-sm/md/lg/xl`) em valores absolutos em
  vez de derivá-la de `--radius`: o `calc()` do shadcn entregaria 4 px em
  controle e 10 px em card, o oposto disto. Hairlines de 1 px, sem sombra
  além do anel de foco.
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
- **Tabelas**: cabeçalho em eyebrow, hairlines, numerais em display tabular.
  **O breakpoint estreito é 768 px** — valor único, em
  `tokens/kumite.tokens.json` como `size.breakpoint-cards`. De **768 px para
  cima**: tabela, com as colunas comprimindo e **sem scroll horizontal na
  página**. **Abaixo de 768 px**: um card por linha. `position: sticky` na
  coluna do time é reforço de leitura dentro da tabela larga, **nunca** a
  resposta ao transbordo — uma coluna fixa só produz efeito num container que
  rola horizontalmente, que é exatamente o que esta regra proíbe.
- **Abas** (painel do organizador): abaixo de 768 px as abas **quebram em duas
  linhas**, todas visíveis, sem scroll lateral e sem trocar de componente; o
  sublinhado vermelho continua marcando a aba ativa.
- **Expansão de texto**: navegação, abas e rótulos são dimensionados pela
  **string mais longa dos três catálogos** (pt/es/en), nunca pela portuguesa —
  "Rodadas" / "Rondas" / "Rounds" não medem o mesmo, e é a maior que decide se
  a barra cabe.
- **Ao vivo**: ponto vermelho + texto em eyebrow vermelho; timer em Barlow
  Condensed 600. No header, que é carvão nos dois modos, o chip e a contagem
  usam `brand-on-chrome`; sobre papel ou cartão, `brand-text`. Nos últimos
  5 min o timer só muda de peso, não de token.
- **Ícones**: traço de 2 px em grade 24 (estilo Lucide, já usado pelo shadcn).
  Sem emoji.
- **Telão** (placar projetado): tela cheia, tema escuro forçado, sem
  header/rodapé, **título do telão** 84 px e **contagem do telão** 96 px em
  `brand-text` (os dois papéis da tabela de tipografia, pelos mesmos nomes),
  linhas ≥ 28 px, legenda A/B/C no rodapé, `Esc` sai. A densidade é
  **constante**: nenhum estado encolhe a tipografia para caber mais um time.
  São **três estados** e uma regra de movimento — o telão fica no ar o evento
  inteiro, não só durante uma rodada.

  **(a) Rodada ao vivo.** Chip "Rodada N · ao vivo" e a contagem de 96 px no
  canto direito. **Transbordo**: `N` é o número de linhas **inteiras** que cabem
  na altura da tela nessa densidade — nenhuma linha pode ficar cortada na borda
  inferior, e uma tela projetada não rola. Quando há mais times do que `N`, o
  telão **pagina o ranking inteiro a cada 15 s** (Top N, depois os seguintes, e
  volta ao começo), com um indicador discreto de página no rodapé, ao lado da
  legenda A/B/C — "1 / 2 · troca a cada 15 s". Não há pódio congelado: a
  paginação percorre a tabela toda, inclusive o topo. Com `N` times ou menos não
  há paginação nem indicador.

  **(b) Sem rodada aberta.** É onde o projetor passa a maior parte do tempo de
  sala. O telão mostra o **placar Geral acumulado**; o chip "ao vivo" e a
  contagem de 96 px dão lugar, **no mesmo canto** do layout `space-between`, a
  um selo `Geral` mais a eyebrow "Aguardando a próxima rodada" — o canto nunca
  fica vazio. Transbordo e paginação valem igual.

  **(c) Rodada recém-encerrada.** O momento da revelação: ranking final da
  rodada que acabou, chip "Rodada N · encerrada" em `muted` no lugar do "ao
  vivo", e o horário de encerramento no lugar da contagem. Mantém-se até a
  próxima rodada abrir ou até o organizador sair do telão.

  **(d) Mudança de posição por SSE.** É a razão de existir de um placar
  projetado: quando uma submissão muda a classificação, a linha **desliza** para
  a posição nova em ~400 ms e fica **realçada em `brand-soft`** por ~3 s,
  esvaindo — nunca um redraw silencioso. Vale nos três estados e respeita
  `prefers-reduced-motion` (abaixo).

### Acessibilidade e movimento

- **Sair do telão tem dois caminhos, os dois obrigatórios.** Com
  `requestFullscreen`, o `Esc` é consumido pelo navegador e o `keydown` **não
  chega à página**: um listener de tecla sozinho deixa o usuário fora do
  fullscreen mas ainda no tema forçado e sem chrome. Então a saída escuta
  **`fullscreenchange`** — que cobre o `Esc`, o F11 e qualquer saída disparada
  pelo navegador — **e** o `keydown` de `Esc`, que cobre o fallback sem a
  Fullscreen API. Qualquer um dos dois restaura header, rodapé e o tema que o
  usuário tinha escolhido; sair pelo botão passa pelo mesmo caminho.
- **Foco**: ao entrar no telão o foco vai para o botão "Sair do telão"; ao sair,
  volta para o gatilho que o abriu. O botão tem nome acessível mesmo quando é
  só ícone.
- **Contagem regressiva**: o timer que muda de segundo em segundo é
  `aria-live="off"`. Um timer em `aria-live` interrompe o leitor de tela **a
  cada segundo** — e o chip da rodada está em **toda** tela autenticada, não só
  no telão. A informação chega por um **resumo textual não-live** ("Rodada 2
  termina em 41 minutos"), atualizado no máximo uma vez por minuto.
- **`prefers-reduced-motion`**: desliga as transições, a pulsação do ponto "ao
  vivo" e a reordenação animada das linhas. O estado final é idêntico — a linha
  aparece já na posição nova, e o realce entra e sai sem interpolação.

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
| resolver (raiz) | `#2A2523` | texto `#F3F1EF`; é o tatame — **não apagável nem duplicável, mas arrastável** (contrato travado em `front/src/components/blockly/editor-contract.test.tsx`) |
| entrada | `#DD2824` | o único bloco vermelho do canvas |

Chrome do editor nos tokens da UI: toolbox em cartão com barra de categoria de
4 px, grade de pontos em papel 2 (20 px), zoom/lixeira em círculos de 32 px,
flyout com a mesma borda. Tema escuro: mesmas cores de bloco, grade em cartão
escuro. Implementação via `Blockly.Theme.defineTheme` dentro de
`@kumite/blocks` (`blockStyles`, `categoryStyles`, `componentStyles`).

## 7. Telas de referência

PNG de cada tela em `screens/` e artboards editáveis em `canvas/`:
início, rodada (lista de problemas, desktop e celular), login (painel-pôster),
cadastro no celular, editor claro e escuro,
times, placar, telão, painel do organizador; pranchas de símbolo, paleta,
tipografia, componentes e Blockly.

## 8. Vocabulário de aplicação

- "PUCRS × Mérida — programação em blocos" é a tagline; o × pode ir em
  vermelho em contextos de pôster.
- Nome do produto: `kumite`, minúsculo, também no meio de frase.
- Rodapé: "PUCRS × Mérida 2026" com o símbolo em 16 px.
