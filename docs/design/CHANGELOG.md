# Changelog — identidade visual do kumite

Registro datado das decisões de design. Uma entrada por mudança de direção,
paleta, tipografia ou logo; ajustes de implementação ficam nos PRs.

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
