# Logo do kumite — arquivos e regras

Os **SVGs são a fonte**; `png/` é derivado por `export.sh` (librsvg). Editou um
SVG? Rode `sh docs/design/logo/export.sh` e commite os dois.

| Arquivo | O que é | Onde usar |
|---|---|---|
| `kumite-mark.svg` | símbolo, vermelho + tinta, fundo transparente | fundos claros; base do componente `Mark` do front |
| `kumite-mark-dark.svg` | símbolo, vermelho + papel | fundos escuros / chrome |
| `kumite-mark-mono-ink.svg` · `-mono-red.svg` · `-mono-paper.svg` | uma cor só | carimbo, bordado, impressão em preto, marca d'água |
| `kumite-wordmark.svg` · `-paper.svg` | "kumite" contornado (Barlow Condensed 600, tracking −1%) | quando não há a fonte instalada |
| `kumite-lockup-horizontal.svg` · `-dark.svg` | símbolo + wordmark lado a lado, fundo transparente | header, assinatura de e-mail, documentos |
| `kumite-lockup-horizontal-on-paper.svg` · `-on-ink.svg` | idem, com placa de fundo e margem | redes sociais, slides, quando o fundo não é controlado |
| `kumite-lockup-stacked.svg` · `-dark.svg` | símbolo sobre o wordmark | avatar quadrado, capa, pôster |
| `kumite-app-icon.svg` | placa vermelha arredondada com o símbolo em papel + tinta | ícone de app, `apple-touch-icon` |
| `favicon.svg` | símbolo que troca o bloco direito conforme `prefers-color-scheme` | `front/public/favicon.svg` |

`png/` traz **36 arquivos**: o símbolo em 16, 24, 32, 64, 128, 256, 512 e
1024 px (claro e escuro), o ícone de app em 512 e 1024, `favicon-32.png`,
`apple-touch-icon-180.png` e cada lockup/wordmark em 1200 e 2400 px de largura.
O 24 está na lista porque é o tamanho do símbolo no header.

No fim do export, `export.sh` chama `../canvas/generate/check_mark.py`, que abre
os PNGs de 16, 24, 32 e 64 px, mede a linha central e **falha se os dois blocos
se tocarem**. O vão é o conceito da marca, e quem o define é o path *mais* o
inchaço do `stroke-width` — a v1 saiu com 4/64 na spec e 1/64 na tela sem que
nada reclamasse (#227).

## Regras

1. Vermelho é sempre o bloco da **esquerda**. O da direita usa a cor do texto
   do fundo (tinta no claro, papel no escuro). Nunca inverta.
   **Única exceção, o ícone de app** (`kumite-app-icon.svg` e o
   `apple-touch-icon`): ali o vermelho é a **placa**, e os blocos são papel
   (esquerda) + tinta (direita). Vale só nesse suporte, porque o vermelho já é
   a superfície e um bloco vermelho em cima dele sumiria. Em qualquer outro
   lugar a regra vale sem exceção.
2. Área de respiro: metade da altura do símbolo em volta de todo o lockup.
3. Tamanhos mínimos: símbolo 16 px; lockup horizontal 96 px de largura. O
   header é a única exceção, e é documentada: ali o símbolo vai em 24 px, o
   que dá um lockup de ≈ 80 px, aceitável porque o contexto já nomeia o
   produto.
4. Nunca girar, espelhar, esticar, contornar, aplicar gradiente, sombra ou
   glow, nem colocar sobre foto sem placa sólida.
5. Sobre outras cores que não papel/tinta/carvão, use a versão monocromática.
6. O wordmark é sempre `kumite` minúsculo; não use a fonte do sistema para
   recompô-lo — use o SVG contornado.

## Regenerar a partir do zero

O gerador (`../canvas/generate/make_logo.py`) reconstrói todos os SVGs a partir
do path do símbolo e da Barlow Condensed 600. Só é necessário se a geometria do
símbolo ou o wordmark mudarem.

A geometria do símbolo mora em **`../canvas/generate/mark.py`** e em nenhum
outro lugar — é o único arquivo a editar. A fonte é **versionada** em
`../canvas/generate/fonts/` (proveniência no README de lá), então o gerador
roda offline.

A partir da raiz do repositório:

```sh
python3 -m venv .venv
.venv/bin/pip install -r docs/design/canvas/generate/requirements.txt
.venv/bin/python docs/design/canvas/generate/make_logo.py
sh docs/design/logo/export.sh
```

Mudou a geometria? Os artboards do canvas também mostram o símbolo, então o
ciclo completo continua:

```sh
.venv/bin/python docs/design/canvas/generate/build.py
node docs/design/canvas/generate/shot.mjs
.venv/bin/python docs/design/canvas/generate/build.py   # heights.json realimenta o build
```

Commite SVGs, PNGs, artboards e telas juntos.
