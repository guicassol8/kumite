# canvas — arquivos-fonte do canvas de design

- `*.dc.html` — um artboard por arquivo, no formato Design Component que a
  skill `/design` do Claude Code consome. Abrem direto no navegador. `Main.dc.html`
  é o editor de problema (artboard de entrada).
- `canvas.json` — layout: duas páginas (`identidade`, `telas`), posições,
  tamanhos e notas.
- `generate/` — gerador. `python3 build.py` reescreve todos os artboards e o
  `canvas.json` a partir de `common.py` (tokens, CSS, ícones, símbolo, chrome),
  `screens.py`/`screens2.py` (telas) e `identity.py` (pranchas). `node shot.mjs`
  tira um PNG de cada artboard em `../screens/` usando o Playwright já instalado
  em `front/` (`pnpm install` na raiz basta) e grava `heights.json`, que o
  `build.py` usa para dimensionar os frames fluidos.
  `make_logo.py` gera os SVGs de `../logo/` (precisa de `fonttools` e da Barlow
  Condensed 600 em TTF, baixada do Google Fonts para `generate/fonts/`, que não
  é versionada). Os três scripts rodam de qualquer diretório.

Fluxo para alterar uma tela: editar o gerador → `python3 build.py` →
`node shot.mjs` → conferir `../screens/` → re-semear o canvas com `/design`
(passando estes artboards e o `canvas.json`) → commitar artboards, PNGs e
gerador juntos.
