# kumite — prompts de geração de imagem para o logo

Os prompts abaixo seguem a direção fechada em 2026-09-10 (ver `identity.md`):
símbolo **"dois blocos em guarda"** + wordmark **kumite** em minúsculas, paleta
**vermelho faixa + carvão** (variante A · Hinomaru), sensação de dojo moderno,
referências Linear/Vercel + pôster esportivo.

Antes de gerar, duas verdades sobre modelos de imagem:

- Eles são ótimos para **explorar** silhuetas, proporções e texturas do símbolo
  e para produzir arte de pôster/telão. São ruins em geometria exata e em
  texto. Por isso o símbolo canônico já existe como vetor em `logo/` — use os
  prompts para achar uma versão melhor da forma, não para reproduzir o SVG.
- O resultado bom vira vetor de novo (Illustrator › Image Trace, Vectorizer.ai,
  Inkscape › Trace Bitmap) e entra em `logo/` substituindo o SVG provisório.
  O wordmark **não** sai do gerador: é Barlow Condensed 600 tipografado, já
  contornado em `logo/kumite-wordmark.svg`.

Os prompts estão em inglês porque os modelos respondem melhor assim. Cores em
hex, para copiar.

---

## 1. Símbolo — Midjourney v7 (o principal)

```
minimalist vector logo mark, two identical geometric block silhouettes facing each other like sparring partners, each block is a tall rounded rectangle with a small trapezoid tab on top and a matching notch cut into the bottom (puzzle-piece style connector), the right block is the left block rotated 180 degrees, a thin tense gap of empty space separates them so they almost interlock but do not touch, left block in vermilion red #E4312B, right block in near-black ink #1C1716, on a flat warm off-white background #FCFAF7, flat solid fills, sharp clean edges, tiny corner radius, perfectly symmetrical rotational composition, centered, generous negative space, modern dojo brand, Japanese sun-red and sumi-ink restraint, Swiss geometric logo design, no gradients, no shadows, no outline, no text --ar 1:1 --style raw --s 50 --v 7 --no karate, fighter, fist, belt, kimono, person, mascot, cartoon, face, code brackets, binary, circuit, glow, neon, gradient, 3d, bevel, texture, text, letters, watermark
```

Variações que valem a pena (troque só o trecho indicado):

- **Vão forma um "k"**: acrescente antes de `left block in vermilion`:
  `the negative space between the two blocks subtly suggests a lowercase letter k,`
- **Mais "duelo"**: troque `facing each other like sparring partners` por
  `squared off against each other like two fighters bowing before a match, one a half-step higher than the other`
- **Versão escura** (para app icon e telão): troque o fundo e o bloco direito:
  `right block in warm paper white #F3F1EF, on a flat charcoal background #120F0D`

## 2. Lockup horizontal — Midjourney v7

```
minimalist brand lockup on a flat warm off-white background #FCFAF7: on the left a small geometric logo mark made of two identical block silhouettes with a puzzle tab on top and a notch below, rotated 180 degrees from each other, facing each other across a thin gap, left block vermilion red #E4312B and right block near-black ink #1C1716; to the right the word "kumite" in lowercase, a bold condensed grotesque sans-serif typeface similar to Barlow Condensed SemiBold, tight letter spacing, near-black ink #1C1716, optically aligned to the mark's height; flat vector, Swiss modernist logo design, generous margins, no tagline, no gradients, no shadows --ar 3:1 --style raw --s 50 --v 7 --no karate, fighter, person, mascot, code symbols, glow, neon, gradient, 3d, texture, extra words, watermark
```

## 3. Símbolo + wordmark — DALL·E 3 / GPT-image / Ideogram (linguagem natural)

Esses modelos escrevem texto melhor; peça o wordmark explicitamente e cheque a
grafia (só "kumite", minúsculo, sem acento).

```
A minimalist flat vector logo for "kumite", a competitive block-programming event between two universities. The symbol is two identical geometric block shapes — tall rounded rectangles, each with a small trapezoid tab on its top edge and a matching notch cut into its bottom edge, like simplified puzzle pieces — placed side by side and facing each other, the right one rotated 180 degrees relative to the left, separated by a thin gap so they almost interlock but never touch: two opponents in guard, the instant before the first move. The left block is vermilion red (#E4312B), the right block is near-black ink (#1C1716). Below or beside the symbol, the word "kumite" written exactly like that, all lowercase, in a bold condensed grotesque sans-serif (in the spirit of Barlow Condensed SemiBold) with tight letter spacing, in the same near-black ink. Flat solid colors on a warm off-white background (#FCFAF7), sharp edges with tiny corner radii, generous empty space, Swiss modernist restraint, the calm of a Japanese dojo. No gradients, no shadows, no outlines, no 3D, no glow, no karate figures, fists, belts or kimonos, no mascots, no code symbols such as braces or brackets, no extra text.
```

## 4. Ícone de app / avatar — Midjourney v7

```
app icon, a rounded square filled with flat vermilion red #E4312B, centered inside it a logo mark of two identical block silhouettes with a puzzle tab on top and a notch below, rotated 180 degrees from each other, facing each other across a thin gap, left block in warm paper white #F3F1EF and right block in near-black ink #1C1716, flat vector, no gradients, no shadows, no text, iOS icon proportions --ar 1:1 --style raw --s 50 --v 7 --no karate, fighter, mascot, glow, gradient, 3d, bevel, text, watermark
```

## 5. Arte de pôster e telão (não é o logo, é ambientação)

Para abertura do evento, capa de redes ou fundo do telão. Aqui gradientes e
textura são bem-vindos, desde que o símbolo continue chapado.

```
sports tournament poster, huge bold condensed grotesque typography reading "KUMITE" in warm paper white #F3F1EF on a charcoal background #120F0D, a large flat vermilion red #E4312B geometric logo mark of two block silhouettes facing each other across a gap, subtle paper grain, diagonal composition with a lot of negative space, one thin vermilion rule, small caps line "PUCRS × MÉRIDA — 2026", Swiss modernist poster meets modern dojo, restrained, no photos, no fighters, no code symbols --ar 2:3 --style raw --s 100 --v 7 --no karate, fighter, person, mascot, glow, neon, rainbow gradient, 3d, clutter
```

## Checklist depois de gerar

1. Funciona em 16 px? (favicon) — se os blocos viram uma mancha, aumente o vão
   ou reduza o detalhe da aba.
2. Funciona em uma cor só? (carimbo, bordado, impressão em preto) — a marca
   precisa sobreviver sem o vermelho.
3. O bloco vermelho é sempre o da **esquerda**; o da direita toma a cor do
   texto do fundo (tinta no claro, papel no escuro).
4. Vetorize e substitua `logo/kumite-mark.svg` mantendo a viewBox 0 0 64 64,
   para que o componente `Mark` do front continue funcionando sem mudanças.
