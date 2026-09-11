# Fontes versionadas

As fontes que os artboards e o wordmark usam moram aqui, em WOFF2, **versionadas
no repo de propósito**: antes desta pasta existir, `common.py` pedia as famílias
a `fonts.googleapis.com` e `make_logo.py` abria um TTF que ninguém tinha. Offline
ou atrás de proxy, o `shot.mjs` fotografava as 14 telas em Arial Narrow sem
reclamar, e o gerador do logo não rodava de jeito nenhum (#227).

Com a pasta versionada o gerador roda offline, e os PNGs de `docs/design/screens/`
saem sempre com a tipografia certa — o `shot.mjs` aborta se alguma face não
carregar.

## Origem

Todos os arquivos vêm do repositório **`google/fonts`**, no commit fixo

```
8e44913e4ff26fc997e6856c1ec40ff4791c98c5
```

Licença **SIL Open Font License 1.1** nas três famílias, que permite
redistribuir — o OFL de cada uma vai junto (`OFL-*.txt`), como a licença exige.

| Arquivo | Uso | Origem (`ofl/…` no commit acima) | SHA-256 do TTF de origem |
|---|---|---|---|
| `BarlowCondensed-Medium.woff2` | `--font-display` 500 | `barlowcondensed/BarlowCondensed-Medium.ttf` | `262bd143292ce479ee0cd09a42b47ab173fca8e9c6eb5ed0b5c8a845bc371d17` |
| `BarlowCondensed-SemiBold.woff2` | `--font-display` 600 · **wordmark** | `barlowcondensed/BarlowCondensed-SemiBold.ttf` | `7b619d14bc2327509a9ef32b0890f709626f7ecc9ff61191c2a4314c5499d2d9` |
| `BarlowCondensed-Bold.woff2` | `--font-display` 700 | `barlowcondensed/BarlowCondensed-Bold.ttf` | `e476562ec9c1e16cf16475895b511f08c804f438cc9a9f80a44ea50a0eeb5b65` |
| `BarlowCondensed-ExtraBold.woff2` | `--font-display` 800 | `barlowcondensed/BarlowCondensed-ExtraBold.ttf` | `724c9c25952d5f4a2d87185d9767aa006144c5f0d944dc05bf7d5d603551c260` |
| `Barlow-Regular.woff2` | `--font-body` 400 | `barlow/Barlow-Regular.ttf` | `95aa02c7c43096e0dd44d787ba6216864a67157e402adab59b35572e0c1577ea` |
| `Barlow-Medium.woff2` | `--font-body` 500 | `barlow/Barlow-Medium.ttf` | `f8906f762cb73dca441da034bc363b2d8e2e68bc10d5c05e58717646c20cc4b4` |
| `Barlow-SemiBold.woff2` | `--font-body` 600 | `barlow/Barlow-SemiBold.ttf` | `86577cb32f8abe3673db53ca0f4221e6856751a4f6730c867e00f720f8bb1fc5` |
| `JetBrainsMono-Variable.woff2` | `--font-mono` 400 e 500 | `jetbrainsmono/JetBrainsMono[wght].ttf` | `48715a42ec242c21e9f02692891e147d022299a52e48d5e413e1a942193ffeda` |

Total: **337 KB**. A variável do JetBrains Mono foi renomeada (`[wght]` →
`-Variable`) só para tirar o colchete de dentro de um `url()` de CSS.

A Inter esteve aqui (350 KB, metade da pasta) enquanto o corpo do texto era uma
decisão em aberto: o artboard de tipografia trazia um controle para alternar
Barlow ↔ Inter e comparar. A decisão fechou em Barlow em 2026-09-10 (CHANGELOG
v1.0), e o arquivo saiu na #228 junto com o controle. O `'Inter'` que continua
em `tokens.css` e em `kumite.tokens.json` é outra coisa: é fallback da pilha de
`--font-sans`, não resíduo dessa escolha.

## Por que não subsetadas

Subsetar para latin + latin-ext cortaria o JetBrains Mono de 72 para 46 KB.
Não foi feito **de propósito**: um glifo fora do subset não dá erro, renderiza
tofu — exatamente a classe de degradação silenciosa que a #227 existe para
eliminar. 26 KB num diretório de docs não pagam esse risco.

## Como reproduzir

Baixar os TTFs de origem (o `%5B`/`%5D` é o colchete escapado na URL):

```sh
SHA=8e44913e4ff26fc997e6856c1ec40ff4791c98c5
BASE="https://raw.githubusercontent.com/google/fonts/$SHA/ofl"
cd docs/design/canvas/generate/fonts
for f in Medium SemiBold Bold ExtraBold; do
  curl -sSLO "$BASE/barlowcondensed/BarlowCondensed-$f.ttf"
done
for f in Regular Medium SemiBold; do
  curl -sSLO "$BASE/barlow/Barlow-$f.ttf"
done
curl -sSL -o 'JetBrainsMono[wght].ttf' "$BASE/jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf"
curl -sSL -o OFL-BarlowCondensed.txt   "$BASE/barlowcondensed/OFL.txt"
curl -sSL -o OFL-Barlow.txt            "$BASE/barlow/OFL.txt"
curl -sSL -o OFL-JetBrainsMono.txt     "$BASE/jetbrainsmono/OFL.txt"
```

Conferir os SHA-256 contra a tabela acima (`sha256sum *.ttf`), converter para
WOFF2 e apagar os TTFs:

```sh
../../../../../.venv/bin/python - <<'PY'
import os
from fontTools.ttLib import TTFont
for n in [f for f in os.listdir('.') if f.endswith('.ttf')]:
    f = TTFont(n); f.flavor = 'woff2'; f.save(n[:-4] + '.woff2')
PY
mv 'JetBrainsMono[wght].woff2' JetBrainsMono-Variable.woff2
rm -f ./*.ttf
```

O venv é o de `docs/design/canvas/generate/requirements.txt` — `brotli` é o que
dá a `fontTools` a capacidade de escrever WOFF2.

## Quem consome

- `common.py` → bloco `@font-face` emitido por `page()` em todo artboard, por
  caminho relativo (`generate/fonts/*.woff2`). Nenhuma requisição externa.
- `make_logo.py` → `BarlowCondensed-SemiBold.woff2`, contornada em paths para o
  wordmark e os lockups.
- `shot.mjs` → exige que Barlow Condensed, Barlow e JetBrains Mono estejam
  `loaded` antes de fotografar, e aborta se não estiverem.
