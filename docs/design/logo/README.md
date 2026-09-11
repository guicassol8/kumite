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

`png/` traz o símbolo em 16–1024 px (claro e escuro), o ícone de app em 512 e
1024, `favicon-32.png`, `apple-touch-icon-180.png` e cada lockup/wordmark em
1200 e 2400 px de largura.

## Regras

1. Vermelho é sempre o bloco da **esquerda**. O da direita usa a cor do texto
   do fundo (tinta no claro, papel no escuro). Nunca inverta.
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
do path do símbolo e da fonte Barlow Condensed 600 (baixada do Google Fonts em
TTF; requer `fonttools` num venv Python). Só é necessário se a geometria do
símbolo ou o wordmark mudarem.
