# docs/design — identidade visual do kumite

Tudo o que define a cara do kumite vive aqui, versionado, sem depender de
conta em ferramenta nenhuma. Quem precisa implementar uma tela lê
`identity.md` e `tokens/`; quem precisa do logo pega `logo/`; quem quer ver ou
retocar o design abre `canvas/`.

```
docs/design/
├── identity.md          spec em prosa: conceito, paleta, tipografia, regras, componentes, Blockly
├── tokens/
│   ├── kumite.tokens.json   fonte da verdade dos valores (W3C Design Tokens 2025.10)
│   └── tokens.css           CSS derivado, pronto para front/src/index.css
├── logo/                SVG (fonte) + png/ (derivado por export.sh) + README com regras
├── logo-prompts.md      prompts de geração de imagem para explorar o símbolo
├── screens/             um PNG por tela e prancha, para consulta rápida
├── canvas/              artboards .dc.html + canvas.json + gerador (Python/Node)
└── CHANGELOG.md         decisões de design, datadas
```

## Como isso foi feito e como regerar

O design foi criado num **canvas do Claude Design** (skill `/design` do Claude
Code), publicado como artifact. O artifact fica preso à conta que o publicou;
por isso os **arquivos-fonte do canvas** estão em `canvas/`:

- `canvas/*.dc.html` — um artboard por arquivo. Cada um abre direto no
  navegador como página normal (é HTML com estilos inline).
- `canvas/canvas.json` — posições, páginas ("Identidade" e "Telas") e notas.
- `canvas/generate/` — o gerador que escreve esses artboards (`build.py` e
  módulos), o script de screenshots (`shot.mjs`, usa o Playwright do `front/`),
  `make_logo.py` (SVGs do logo), `mark.py` (a geometria do símbolo, num lugar
  só), `check_mark.py` (mede o vão nos PNGs) e `fonts/` (as fontes versionadas
  em WOFF2 — nada vem de `fonts.googleapis.com`). Os scripts Python precisam do
  venv de `canvas/generate/requirements.txt`.

Para regerar o artifact em qualquer conta: abra uma sessão do Claude Code neste
repo, rode `/design` e peça para **re-semear o canvas a partir de
`docs/design/canvas/`** (os artboards e o `canvas.json` já estão no formato que
a skill consome). **Leve `canvas/generate/fonts/` junto**: os artboards trazem
as fontes por `@font-face` com caminho relativo (`generate/fonts/*.woff2`), e um
artboard publicado sem essa pasta ao lado cai no fallback do sistema **sem erro
nenhum** — a mesma degradação silenciosa que a #227 tirou do `shot.mjs`, que só
guarda o caminho local. Confira a tipografia do artifact contra
`screens/Tipografia.png` depois de re-semear. Para mudar uma tela de forma
consistente, edite o gerador
(`generate/*.py`), rode `build.py` → `shot.mjs` → `build.py` (o segundo é
preciso porque o `shot.mjs` grava `heights.json`, que realimenta o
dimensionamento dos frames fluidos):

```sh
.venv/bin/python docs/design/canvas/generate/build.py
node docs/design/canvas/generate/shot.mjs
.venv/bin/python docs/design/canvas/generate/build.py
```

Exportar PNG/PDF: no artifact, pelo botão Export da barra; fora dele,
`screens/` já tem cada prancha em PNG e `logo/export.sh` regenera os PNGs do
logo.

## Práticas adotadas (e por quê)

- **Tokens em JSON no formato W3C DTCG** como fonte da verdade dos valores,
  CSS derivado. É o formato que Figma, Penpot, Style Dictionary e Tokens
  Studio consomem; quando a fundação do redesign entrar, `tokens.css` pode
  passar a ser gerado por Style Dictionary em vez de mantido à mão. Uma
  hierarquia só, sem exceção: **`kumite.tokens.json` manda nos valores**,
  `tokens.css` é derivado à mão a partir dele e `identity.md` é a spec em
  prosa, que cita token e nunca valor.
- **A #216 copia de `tokens.css` os blocos `:root`, `.dark` e `@theme inline`
  para `front/src/index.css`, e mais nada.** Os `--block-*` são consumidos
  por `@kumite/blocks`, não pelo tema do front.
- **Os tokens são conferidos por script**, não no olho:
  `python3 canvas/generate/check_tokens.py` falha se `tokens.css` e
  `kumite.tokens.json` divergirem, se o `oklch` anotado não render o hex ao
  lado, se algum `oklch` só chegar naquela cor por clipagem de gamut, ou se
  a tabela de contraste de `identity.md` não bater com o que os valores
  rendem.
- **Camadas de token**: primitivos (`color.primitive.red-600`) → semânticos
  por modo (`color.light.brand`, `color.dark.brand`) → uso em componentes via
  as variáveis CSS do shadcn. Só os semânticos aparecem no código.
- **SVG é fonte, PNG é build.** Nunca edite um PNG; edite o SVG e rode o
  script. O wordmark é contornado para não depender de fonte instalada.
- **Contraste medido, não estimado**: a tabela em `identity.md` lista as
  razões WCAG dos pares que a spec manda usar, recalculadas pelo
  `check_tokens.py`; um token novo entra com o número, e um par que não
  atinge o mínimo entra dizendo isso — a tabela nunca afirma cobertura que
  não tem.
- **Changelog de decisões** (`CHANGELOG.md`), uma entrada por mudança de
  direção, com o porquê. Versão da identidade (v1, v2…) independe da versão do
  app.
- **Governança**: mudar paleta, tipografia ou logo = PR que toca
  `docs/design/` + entrada no changelog; as telas do front seguem os tokens,
  nunca o contrário. Divergência entre canvas e `identity.md`: vale o doc.
- **Um lugar para o símbolo no código**: `front/src/components/brand/`
  (fundação do redesign). Nenhum outro arquivo desenha o SVG.

## E se um dia quiser Figma

Não é necessário — tudo aqui é editável e exportável. Se for útil: os SVGs de
`logo/` entram no Figma por arrastar-e-soltar como vetores editáveis;
`tokens/kumite.tokens.json` importa como variáveis pelo plugin Tokens Studio
(sincronia com este repositório via GitHub); e os artboards `.dc.html`, servidos
localmente (`python3 -m http.server` dentro de `canvas/`), viram camadas
editáveis com um plugin de importação de HTML (html.to.design, Anima ou o
conector oficial do Figma no Claude Code, que também constrói telas a partir
do código).

## Fontes consultadas (2026-09-10)

- Design Tokens Format Module 2025.10 (primeira versão estável) —
  https://www.designtokens.org/tr/drafts/format/ e
  https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/
- Style Dictionary e o formato DTCG — https://styledictionary.com/info/dtcg/
- Tokens Studio + Style Dictionary — https://docs.tokens.studio/transform-tokens/style-dictionary
- Versionamento de design systems (semver, changelog, alinhamento entre
  ferramentas) — https://www.knapsack.cloud/blog/version-control-for-design-systems
  e https://practicaldesignsystems.com/daily/versioning-and-release-best-practices/
- html.to.design e alternativas — https://html.to.design/home/ e
  https://html2design.com/alternatives
