# canvas — arquivos-fonte do canvas de design

- `*.dc.html` — um artboard por arquivo, no formato Design Component que a
  skill `/design` do Claude Code consome. Abrem direto no navegador. `Main.dc.html`
  é o editor de problema (artboard de entrada).
- `canvas.json` — layout: duas páginas (`identidade`, `telas`), posições,
  tamanhos e notas.
- `generate/` — gerador. `build.py` reescreve todos os artboards e o
  `canvas.json` a partir de `common.py` (tokens, CSS, ícones, símbolo, chrome),
  `screens.py`/`screens2.py` (telas) e `identity.py` (pranchas). `node shot.mjs`
  tira um PNG de cada artboard em `../screens/` usando o Playwright já instalado
  em `front/` (`pnpm install` na raiz basta) e grava `heights.json`, que o
  `build.py` usa para dimensionar os frames fluidos.
  `make_logo.py` gera os SVGs de `../logo/`; a geometria do símbolo mora em
  `mark.py`, num lugar só. Os scripts rodam de qualquer diretório.

## Antes de rodar qualquer coisa: o venv

Os scripts Python dependem de `generate/requirements.txt`. A partir da raiz do
repositório:

```sh
python3 -m venv .venv
.venv/bin/pip install -r docs/design/canvas/generate/requirements.txt
```

As fontes **são versionadas** em `generate/fonts/` (WOFF2 + OFL + proveniência
no README de lá) e servidas por `@font-face` com caminho relativo. Nenhum
artboard fala com `fonts.googleapis.com`, e é de propósito: enquanto falava, um
`shot.mjs` rodado offline commitava as 14 telas em Arial Narrow sem erro nenhum
(#227). Hoje o `shot.mjs` aborta antes de escrever qualquer PNG se alguma face
não carregar.

## Fluxo para alterar uma tela

Editar o gerador → `build.py` → `shot.mjs` → `build.py` → conferir `../screens/`
→ re-semear o canvas com `/design` (passando estes artboards e o `canvas.json`)
→ commitar artboards, PNGs e gerador juntos.

```sh
.venv/bin/python docs/design/canvas/generate/build.py
node docs/design/canvas/generate/shot.mjs
.venv/bin/python docs/design/canvas/generate/build.py
```

O `build.py` roda **duas vezes** porque o `shot.mjs` grava `heights.json` entre
os dois, e é ele que dimensiona os frames fluidos; sem o segundo, o
`canvas.json` fica descrito com as alturas da rodada anterior.
