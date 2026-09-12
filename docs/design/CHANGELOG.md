# Changelog — identidade visual do kumite

Registro datado das decisões de design. Uma entrada por mudança de direção,
paleta, tipografia ou logo; ajustes de implementação ficam nos PRs.

## v1.4 — 2026-09-12 — o card social e o ícone de 192 px (#230)

Duas cascas globais (404, erro do router) e os metadados de compartilhamento
não tinham dono — `og:image` em especial, porque o link do kumite vai
circular por WhatsApp e Instagram e a alternativa era um retângulo cinza com a
URL. Conceito, paleta e tipografia não mudam de direção aqui.

- **`kumite-og-card.svg`, a segunda exceção à Regra 1.** Fundo carvão, lockup
  em vermelho + papel — a mesma inversão que as variantes `-dark` já fazem,
  não uma nova. 1200×630, lockup horizontal a 60% da largura (720 px),
  centrado nos dois eixos. Sem tagline: o wordmark já é a peça inteira do
  card. Gerado a partir do mesmo par (mark + wordmark 55px) que o lockup
  horizontal usa, escalado — não é uma composição nova.
- **`kumite-app-icon-192.png`.** O manifest do PWA (`front/manifest.webmanifest`,
  #230) pede um ícone abaixo de 512, que não existia; 512 e 1024 continuam
  servindo apple-touch-icon e splash/lojas.

## v1.3 — 2026-09-11 — o telão fora do instante único, o chrome inteiro e o breakpoint com número (#228)

Auditoria do que as issues do epic mandam construir contra o que `identity.md`
e o canvas de fato descrevem. Três superfícies não existiam em lugar nenhum —
nem no doc, nem em prancha —, então a regra de governança ("divergência entre
canvas e doc: vale o doc") não resolvia: quem implementasse inventaria, e
descobriria no review. Conceito, paleta e tipografia não mudam de direção aqui.

- **O telão tem três estados, não um.** Ele foi desenhado num único instante
  (rodada aberta, seis times, relógio correndo) e não tinha regra para o resto
  do evento. Agora: **(a) rodada ao vivo**, **(b) sem rodada aberta** — que é
  onde o projetor passa a maior parte do tempo de sala, e onde o canto do
  `space-between` ficava vazio: vira placar Geral acumulado, com selo `Geral` e
  eyebrow no lugar do chip e da contagem — e **(c) rodada recém-encerrada**, o
  momento da revelação. Prancha nova para (b); (c) fica descrita em texto.
- **Transbordo: Top N + paginação de 15 s.** A prancha tinha 6 times e o
  gerador não tinha limite de linhas, enquanto o painel do organizador afirma
  21 — 15 ficavam abaixo da borda, e ninguém rola uma tela projetada. A
  densidade é **constante** (a alternativa, encolher a tipografia até um piso,
  foi descartada: o telão é lido de longe e vale mais mostrar todos os times
  em rodízio do que todos de uma vez pequenos). `N` = quantas linhas inteiras
  cabem na altura, e o ranking **inteiro** pagina a cada 15 s, sem pódio
  congelado, com indicador de página no rodapé.
- **Movimento por SSE, escrito.** A mudança de posição é a razão de existir de
  um placar projetado e chegava como redraw silencioso: agora a linha desliza
  em ~400 ms e fica realçada em `brand-soft` por ~3 s.
- **Acessibilidade do telão.** Sair tem **dois caminhos obrigatórios**:
  `fullscreenchange` **e** `keydown`. Não é redundância — com
  `requestFullscreen` o `Esc` é consumido pelo navegador e o `keydown` nunca
  chega à página, então um listener de tecla sozinho deixa o usuário fora do
  fullscreen mas ainda no tema forçado e sem chrome. Mais: foco entra no botão
  "Sair do telão" e volta ao gatilho; contagem em `aria-live="off"` com resumo
  textual não-live, porque um timer live interrompe o leitor de tela a cada
  segundo — e o chip da rodada está em **toda** tela autenticada, não só no
  telão; e `prefers-reduced-motion` desliga transições, a pulsação do ponto
  "ao vivo" e a reordenação.
- **Inventário fechado de header e rodapé.** A #217 manda construir quatro
  elementos que não estavam em prancha nem no doc: menu do usuário (que hospeda
  "Trocar senha"), ícone de reportar bug no desktop, status da API no rodapé e
  o painel de menu do celular — este último o componente mais complexo da
  issue, e o que fecha o #186. O canvas mostrava um header que ninguém ia
  construir. O status da API é **ponto mais rótulo**: a § 3 proíbe cor como
  única pista. O **idioma não entra no painel do celular** — fica no header em
  toda largura, porque é a única preferência que precisa ser alcançável sem
  abrir menu nenhum, inclusive por quem não lê o idioma em que a interface
  abriu. Duas pranchas novas: menu do usuário aberto e painel de 390 px.
- **O breakpoint estreito passa a ter número: 768 px**, também como token
  (`size.breakpoint-cards`). A regra das tabelas se contradizia — prometia
  "sem scroll horizontal em nenhuma largura" e pedia coluna `sticky`, que só
  produz efeito dentro de um container que rola horizontalmente. Agora: de
  768 px para cima, tabela com as colunas comprimindo; abaixo, um card por
  linha; `sticky` é reforço de leitura, nunca a resposta ao transbordo. As abas
  do organizador quebram em duas linhas abaixo de 768 px, e navegação e rótulos
  são dimensionados pela string mais longa dos **três** catálogos, não pela
  portuguesa.
- **O bloco raiz é arrastável — o doc dizia o contrário.** `identity.md` § 6
  afirmava que o `resolver` "não é arrastável", mas `blocks/src/blocks.ts` o
  deixa movível de propósito e `editor-contract.test.tsx` trava esse contrato.
  A #218 aponta o doc como referência e mexe nesse bloco: alguém adicionaria
  `setMovable(false)` "para cumprir a spec" e quebraria o teste.
- **Fim do resíduo de decisão aberta no canvas.** O artboard de tipografia
  ainda trazia o controle para alternar Barlow ↔ Inter, e a annotation da
  paleta ainda dizia "se preferir B ou C, eu re-tokenizo" — as duas fechadas
  desde a v1, e o README manda re-semear o canvas exatamente desses arquivos.
  Com o controle fora, a **Inter sai da pasta de fontes** (350 KB, metade dos
  679 KB que a v1.2 versionou). O `'Inter'` de `tokens.css` fica: ali é
  fallback da pilha de `--font-sans`, não resíduo dessa escolha.
- **5ª checagem: o gerador do canvas.** `canvas/generate/common.py` repete à
  mão os mesmos hex e era a quarta cópia deles, fora do alcance das quatro
  checagens. Foi por aí que um valor sobreviveu ao saneamento da v1.1 (o board
  da paleta mostrando `#E8496A` depois de `--destructive` do escuro virar
  `#EF5C7B`). Agora `check_tokens.py` confere `common.LIGHT/DARK/BLOCKS` contra
  `tokens.css`, com mapa de nomes explícito (o `muted` do gerador é o
  `muted-foreground` do token) e allowlist nomeada — e allowlist obsoleta
  também falha.

## v1.2 — 2026-09-11 — o vão do símbolo e um gerador que roda (#227)

O símbolo é o ativo mais reproduzido da identidade, e o vão entre os dois
blocos **é** o conceito ("elas encaixariam; não encaixam"). Nos tamanhos em que
a marca é de fato usada, ele não existia: 0 px de fundo em 16, 32 e 64 px. Os
dois blocos se tocavam e a marca lia como uma peça sólida bicolor — o oposto do
que a v1 descreve. Conceito e paleta não mudam de direção aqui.

- **Vão: 4/64 → 8/64.** A causa não era o path, era o `stroke-width: 3` que
  arredonda os cantos: ele infla o desenho 1,5 unidade por lado e comia 3 das 4
  unidades do vão, deixando 1/64 na tela. Consertar só o número da spec não
  bastava — vão de 4/64 ainda mede alfa 144/255 nas colunas centrais em 16 px,
  ou seja, cinza, não fundo. Com 8/64 o vão renderizado é 2 px em 16 e 24 px,
  4 px em 32 e 8 px em 64. As bordas do bloco passam a 6,5 (externa) e 26,5
  (interna), a aba/encaixe encolhe de 8 para 6 unidades e a marca fica com
  54/64 de pegada.
- **Sem variante de vão exagerado para 16/32 px.** Foi avaliada, como se faz
  com ícone de app, e dispensada: a geometria única já entrega vão visível em
  todos os tamanhos. A tabela por tamanho está em `identity.md` § 2.
- **O símbolo deixa de ser "provisório" e passa a canônico.** `identity.py`
  dizia uma coisa e `identity.md` outra. Trocar o símbolo pelos prompts de
  `logo-prompts.md` passa a ser **v2 da identidade**, não um ajuste.
- **Exceção do ícone de app, escrita.** No `kumite-app-icon.svg` o vermelho é a
  placa e os blocos são papel + tinta — uma inversão da Regra 1 que os arquivos
  já entregavam e nenhum documento registrava. Agora está em `identity.md` § 2
  e na Regra 1 de `logo/README.md`.

**Infraestrutura** (o que tornava tudo acima impossível de corrigir):

- **O gerador não rodava.** `make_logo.py` importava `fontTools` no topo, sem
  `requirements.txt` em lugar nenhum, e abria um TTF que não era versionado e
  não tinha origem documentada. Agora há `requirements.txt` pinado, os imports
  de fonte estão dentro de `build_wordmark()` (símbolo e favicon saem sem fonte
  alguma) e a falta de qualquer coisa dá erro explícito.
- **Fontes versionadas.** Barlow Condensed 500/600/700/800, Barlow 400/500/600,
  JetBrains Mono e Inter, em WOFF2, com o OFL de cada família e a proveniência
  (commit de origem + SHA-256 de cada TTF) em `canvas/generate/fonts/README.md`.
- **Fim da degradação silenciosa nas telas.** Os artboards pediam a fonte a
  `fonts.googleapis.com` e o `shot.mjs` fotografava depois de um
  `waitForTimeout(1500)`: offline, os 14 PNGs de `screens/` — a referência
  visual citada por nome em sete issues — eram commitados em Arial Narrow, sem
  erro. Agora é `@font-face` local e o `shot.mjs` aborta antes de escrever
  qualquer PNG se alguma face não carregar.
- **Uma geometria só.** O path vivia duplicado em `make_logo.py` e `common.py`,
  sem que um importasse o outro. Agora mora em `canvas/generate/mark.py`, e
  `canvas/generate/check_mark.py` — chamado pelo `export.sh` — mede o vão nos
  PNGs e falha se os blocos se tocarem, para a regressão não voltar calada.

## v1.1 — 2026-09-11 — saneamento da camada de tokens (#225)

Auditoria da camada entregue pela v1: os valores não sobreviviam à
recontagem. Nada de conceito, logo ou tipografia muda de direção aqui.

**Mudou de valor** (a #216 implementa o que está aqui, não o que estava na v1):

- **Erro no escuro**: `destructive` `#E8496A` → **`#EF5C7B`**. Sobre o cartão
  escuro o anterior dava 4,74:1 cheio e **4,07:1** na variante `/90` que o
  shadcn aplica na descrição do `Alert` — abaixo de AA nos 22 usos de
  `<Alert variant="destructive">` que o front tem hoje, em 14 arquivos. Agora
  5,49:1 e 4,67:1. Resolvido no token para a #216 não ter de tocar em cada
  call site.
- **Superfície de estado do escuro**: `muted`/`secondary`/`accent` deixam de
  ser o próprio `card` e ganham **`#282322`**, um degrau acima. Eram
  `#1B1716` idêntico ao cartão (1,00:1), e com isso `hover:bg-muted/50`,
  linha selecionada, botão fantasma e botão secundário não davam retorno
  nenhum.
- **Vermelho sobre o chrome**: token novo **`brand-on-chrome` `#F45246`**,
  igual nos dois modos. O header é carvão sempre, mas `brand-text` só
  clareava dentro de `.dark`: no modo claro o chip "ao vivo" e a contagem
  regressiva ficavam em **3,72:1**. Agora 5,2:1 e 5,7:1.
- **Anel de foco**: passa de `brand-soft` para **`ring`** (= `brand`). Havia
  três definições conflitantes e nenhuma visível — `brand-soft` sobre cartão
  dá 1,2:1. O indicador é borda de 1 px em `ring` + halo de 3 px em
  `ring/50`, que é o que os primitivos do shadcn já fazem; `brand-soft` fica
  sendo fundo de linha e halo.
- **Escala de raio explícita**: `--radius-sm/md/lg/xl` em valores absolutos.
  O `calc()` do shadcn sobre `--radius: 6px` entregava 4 px em controle e
  10 px em card — o oposto dos 6/8 que a spec pede.
- **Contagem do telão**: 96 px, separada do título em 84 px. A v1 dizia 84
  num lugar e 96 no outro para a mesma coisa.

**Só ganhou precisão** (nenhuma cor muda na tela):

- Seis `oklch()` rendiam um hex diferente do que o comentário e o
  `kumite.tokens.json` declaravam; quatro caíam fora do gamut sRGB, onde o
  navegador só chega na cor por clipagem — em tela P3 não clipa e a cor passa
  a divergir do hex gêmeo dos `--block-*` e dos SVGs do logo. **Hex passa a
  ser o valor** e o `oklch` vira anotação conferida por script.
- Tabela de contraste reescrita com os pares que a spec manda usar, incluindo
  os que faltavam (anel de foco, vermelho sobre chrome, `brand-soft` como
  fundo, dificuldade no escuro, borda de controle, degrau de superfície). Sai
  a afirmação de que "bordas e ícones decorativos passam 3:1": era falsa — as
  hairlines ficam em ~1,3:1 e por isso nunca são a única pista.
- `kumite.tokens.json` ganha os semânticos que faltavam (`ring`, `muted`,
  `secondary`, `accent`, `popover`, `input`, `card-foreground`,
  `destructive-foreground`) e uma hierarquia única de fonte da verdade.
- **`canvas/generate/check_tokens.py`**: as quatro checagens (paridade,
  `oklch`↔hex, gamut, contraste) rodam em stdlib puro e falham a divergência.

## v1 — 2026-09-10

Primeira identidade, decidida em sessão de design com o organizador.

- **Sensação**: dojo moderno (foco, disciplina, duelo). Referências: Linear /
  Vercel / Raycast + pôster esportivo.
- **Logo**: símbolo "dois blocos em guarda" + wordmark `kumite` minúsculo
  (Barlow Condensed 600). Símbolo vetorial provisório desenhado à mão em grade
  64; o definitivo pode sair dos prompts em `logo-prompts.md`.
- **Paleta**: vermelho faixa + carvão, variante **A · Hinomaru** (vermilion
  `#DD2824`, tinta `#1C1716`, papel `#FCFAF7`). Alternativas B (Faixa preta)
  e C (Brasa) descartadas, registradas na prancha 02 do canvas.
  Vermelho da marca ajustado de `#E4312B` para `#DD2824` no mesmo dia para
  passar WCAG AA com texto branco (4,77:1) e como texto sobre papel (4,58:1);
  verde `#139948` → `#008433` e âmbar ganhou `warning-text` `#A06700` pelo
  mesmo motivo.
- **Tipografia**: Barlow Condensed (títulos, placar, timer) + Barlow (corpo) +
  JetBrains Mono (JSON). Inter descartada como corpo.
- **Modo de cor**: claro com chrome carvão + escuro completo.
- **Placar**: ganha modo telão (restyle do modo apresentação existente).
- **Blockly**: chrome do editor nos tokens + blocos harmonizados (Variáveis sai
  do rosa para ocre; raiz em tinta; entrada em vermelho).
- **Evitar**: clichês de código, karatê literal, mascote/cartoon.
- Sem cores institucionais da PUCRS ou da Universidad de Mérida: liberdade
  total de marca (decisão do organizador).
