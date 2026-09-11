"""Mede, em pixels, o vão entre os dois blocos do símbolo nos PNGs exportados.

Esta é a guarda contra a regressão da #227 voltar. O vão é o conceito da marca
("elas encaixariam; não encaixam"), mas quem o define é o path em `mark.py`
*mais* o inchaço do `stroke-width` — e é fácil mexer num sem refazer a conta do
outro. Foi assim que a v1 da identidade chegou com vão de 4 unidades na spec e
1 unidade na tela: zero pixel de fundo em 16, 32 e 64 px, com os dois blocos
encostados e a marca lendo como uma peça sólida bicolor.

Medir o SVG não serve: o que quebra é a rasterização em tamanho pequeno. Então
o teste abre o PNG de verdade, na linha central, e conta pixels.

Uso (chamado no fim de ../../logo/export.sh):

    .venv/bin/python docs/design/canvas/generate/check_mark.py
"""
import os
import sys

from mark import GAP_UNITS, GRID, expected_gap_px

try:
    from PIL import Image
except ImportError as e:  # pragma: no cover - caminho de ambiente, não de lógica
    raise SystemExit(
        f"check_mark.py: falta a dependência '{e.name}'.\n"
        "  Instale com:\n"
        "    python3 -m venv .venv\n"
        "    .venv/bin/pip install -r docs/design/canvas/generate/requirements.txt"
    ) from e

HERE = os.path.dirname(os.path.abspath(__file__))
PNG = os.path.normpath(os.path.join(HERE, "..", "..", "logo", "png"))

# Tamanhos em que o símbolo é de fato usado: favicon, header, rodapé, app icon.
SIZES = (16, 24, 32, 64)
# Um pixel só conta como fundo se for essencialmente transparente. Alfa
# intermediário é anti-aliasing, ou seja, tinta — era exatamente o que fazia o
# vão de 4/64 "existir" no arquivo e desaparecer aos olhos.
BACKGROUND_MAX_ALPHA = 8
MIN_GAP_PX = 1


def gap_at_center(path):
    """(vão em px, menor alfa dentro do vão) na linha central de `path`."""
    img = Image.open(path).convert("RGBA")
    w, h = img.size
    row = [img.getpixel((x, h // 2))[3] for x in range(w)]

    # Caminha do centro para fora enquanto o pixel for fundo.
    mid = w // 2
    if row[mid] > BACKGROUND_MAX_ALPHA:
        return 0, row[mid]
    left = mid
    while left - 1 >= 0 and row[left - 1] <= BACKGROUND_MAX_ALPHA:
        left -= 1
    right = mid
    while right + 1 < w and row[right + 1] <= BACKGROUND_MAX_ALPHA:
        right += 1
    span = row[left:right + 1]
    return len(span), max(span)


def main():
    print(f"vão da geometria: {GAP_UNITS:g}/{GRID} unidades")
    print(f"{'tamanho':>8}  {'esperado':>9}  {'medido':>7}  {'alfa máx':>9}  veredito")
    failures = []
    for size in SIZES:
        path = os.path.join(PNG, f"kumite-mark-{size}.png")
        if not os.path.exists(path):
            failures.append(f"{size} px: {path} não existe — rode docs/design/logo/export.sh")
            print(f"{size:>6} px  {'':>9}  {'':>7}  {'':>9}  AUSENTE")
            continue
        measured, alpha = gap_at_center(path)
        ok = measured >= MIN_GAP_PX
        print(f"{size:>6} px  {expected_gap_px(size):>8.1f}p  {measured:>6}p  {alpha:>9}  {'ok' if ok else 'FALHOU'}")
        if not ok:
            failures.append(
                f"{size} px: {measured} pixel de fundo entre os blocos "
                f"(mínimo {MIN_GAP_PX}); os dois blocos se tocam"
            )

    if failures:
        print("\nO símbolo não tem vão visível:", file=sys.stderr)
        for f in failures:
            print(f"  - {f}", file=sys.stderr)
        print(
            "\nO vão é o conceito da marca. Ajuste MARK_PATH/STROKE_WIDTH em\n"
            "docs/design/canvas/generate/mark.py, rode make_logo.py e export.sh\n"
            "de novo. Ver a #227.",
            file=sys.stderr,
        )
        return 1
    print("\nvão visível em todos os tamanhos verificados")
    return 0


if __name__ == "__main__":
    sys.exit(main())
