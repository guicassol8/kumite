"""Geometria canônica do símbolo kumite — "dois blocos em guarda".

**Este é o único lugar do repositório onde o path do símbolo existe.** Quem
precisar dele (`common.py`, `make_logo.py`, `check_mark.py`, e o componente
`Mark` do front pela via do SVG gerado) importa daqui. Trocar o desenho é
editar `MARK_PATH` e rodar o fluxo descrito em `../README.md`.

Construção, em grade de 64:

- Bloco esquerdo com borda externa em x=6,5 e borda interna em x=26,5; o
  direito é o mesmo path sob `rotate(180 32 32)`.
- `stroke-width=3` com `stroke-linejoin="round"` arredonda os cantos, e por
  isso **infla o path em 1,5 unidade para cada lado**: o que se vê vai de
  x=5,0 a x=28,0, e o vão renderizado é 64 - 2×28 = **8 unidades**.

Esse inchaço do stroke é a origem do bug da #227: com a borda interna em 30 (a
geometria v1), os blocos chegavam a 31,5 e o vão de 4 unidades da spec virava
1 — zero pixel de fundo em qualquer tamanho até 64 px. Mexer em `STROKE_WIDTH`
ou nas bordas sem refazer essa conta reintroduz o bug; `check_mark.py` existe
para não deixar isso passar calado.
"""

# Bordas do path, antes do stroke.
OUTER_EDGE = 6.5
INNER_EDGE = 26.5
GRID = 64
STROKE_WIDTH = 3

MARK_PATH = (
    "M6.5 18 L11.5 18 L13.5 12 L19.5 12 L21.5 18 L26.5 18 "
    "L26.5 50 L21.5 50 L19.5 44 L13.5 44 L11.5 50 L6.5 50 Z"
)

# Geometria efetiva, já contando o stroke — é o que o olho (e o rasterizador) vê.
_BLEED = STROKE_WIDTH / 2
INK_OUTER = OUTER_EDGE - _BLEED  # 5.0
INK_INNER = INNER_EDGE + _BLEED  # 28.0
GAP_UNITS = GRID - 2 * INK_INNER  # 8.0


def expected_gap_px(size):
    """Vão esperado, em pixels, quando o símbolo é rasterizado a `size` px."""
    return GAP_UNITS * size / GRID


def mark_paths(left, right, dx=0, dy=0, scale=1.0):
    """O par de blocos como um `<g>`, sem o `<svg>` em volta."""
    t = f"translate({dx} {dy}) scale({scale})" if (dx or dy or scale != 1) else ""
    g_open = f'<g transform="{t}">' if t else "<g>"
    return (
        f"{g_open}"
        f'<path d="{MARK_PATH}" fill="{left}" stroke="{left}" '
        f'stroke-width="{STROKE_WIDTH}" stroke-linejoin="round"/>'
        f'<path d="{MARK_PATH}" fill="{right}" stroke="{right}" '
        f'stroke-width="{STROKE_WIDTH}" stroke-linejoin="round" transform="rotate(180 32 32)"/>'
        f"</g>"
    )


def mark_svg(size=32, left=None, right=None, extra=""):
    """O símbolo completo como `<svg>`, para embutir num artboard."""
    left = left or "var(--brand)"
    right = right or "var(--foreground)"
    return (
        f'<svg width="{size}" height="{size}" viewBox="0 0 {GRID} {GRID}" fill="none" '
        f"aria-hidden=\"true\" {extra}>"
        f'<path d="{MARK_PATH}" fill="{left}" stroke="{left}" '
        f'stroke-width="{STROKE_WIDTH}" stroke-linejoin="round"></path>'
        f'<path d="{MARK_PATH}" fill="{right}" stroke="{right}" '
        f'stroke-width="{STROKE_WIDTH}" stroke-linejoin="round" transform="rotate(180 32 32)"></path>'
        f"</svg>"
    )


if __name__ == "__main__":
    print(f"MARK_PATH   {MARK_PATH}")
    print(f"bordas      externa {OUTER_EDGE} · interna {INNER_EDGE} · stroke {STROKE_WIDTH}")
    print(f"com stroke  {INK_OUTER} a {INK_INNER} · vão {GAP_UNITS}/{GRID}")
    for s in (16, 24, 32, 64, 128):
        print(f"  {s:>4} px -> vão esperado {expected_gap_px(s):g} px")
