"""Generate the kumite logo SVG set: mark, outlined wordmark (Barlow Condensed 600), lockups.

Uso, a partir da raiz do repo (ver ../README.md para o venv):

    .venv/bin/python docs/design/canvas/generate/make_logo.py

O símbolo e o favicon saem sem precisar de fonte nenhuma; só o wordmark e os
lockups dependem da Barlow Condensed 600, que mora versionada em `fonts/`. Por
isso os imports de `fontTools` ficam dentro de `build_wordmark()`: antes da
#227 eles estavam no topo e derrubavam o script inteiro num checkout sem
dependência instalada, inclusive para gerar os arquivos que não usam fonte.
"""
import os

from mark import MARK_PATH, STROKE_WIDTH, mark_paths

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "..", "logo"))  # docs/design/logo
os.makedirs(OUT, exist_ok=True)
RED, INK, PAPER, DARKBG, LIGHTBG = "#DD2824", "#1C1716", "#F3F1EF", "#120F0D", "#FCFAF7"
FONT = os.path.join(HERE, "fonts", "BarlowCondensed-SemiBold.woff2")
TEXT = "kumite"
TRACKING = -0.01  # em
# O path e o par de blocos vêm de mark.py, o único lugar onde a geometria existe.


def svg(w, h, body, bg=None, title="kumite"):
    rect = f'<rect width="{w}" height="{h}" fill="{bg}"/>' if bg else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" fill="none" role="img" aria-label="{title}">\n'
            f'  <!-- kumite · gerado por docs/design/canvas/generate/make_logo.py — símbolo em grade 64, wordmark Barlow Condensed 600 contornado -->\n'
            f'  {rect}{body}\n</svg>\n')


# ---- marks: não dependem de fonte ----
def build_marks():
    open(f"{OUT}/kumite-mark.svg", "w").write(svg(64, 64, mark_paths(RED, INK)))
    open(f"{OUT}/kumite-mark-dark.svg", "w").write(svg(64, 64, mark_paths(RED, PAPER)))
    open(f"{OUT}/kumite-mark-mono-ink.svg", "w").write(svg(64, 64, mark_paths(INK, INK)))
    open(f"{OUT}/kumite-mark-mono-red.svg", "w").write(svg(64, 64, mark_paths(RED, RED)))
    open(f"{OUT}/kumite-mark-mono-paper.svg", "w").write(svg(64, 64, mark_paths(PAPER, PAPER)))
    # app icon: red rounded square, paper + ink blocks.
    # Exceção deliberada à Regra 1 de ../../logo/README.md: aqui o vermelho é a
    # placa, não o bloco da esquerda. É a única inversão permitida.
    open(f"{OUT}/kumite-app-icon.svg", "w").write(svg(512, 512,
        f'<rect width="512" height="512" rx="112" fill="{RED}"/>' + mark_paths(PAPER, INK, dx=96, dy=96, scale=5)))
    # favicon: mark on transparent (browser tab), plus a dark-safe variant handled by prefers-color-scheme in the same file
    open(f"{OUT}/favicon.svg", "w").write(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">\n'
        f'  <style>.r{{fill:{INK};stroke:{INK}}} @media (prefers-color-scheme: dark){{.r{{fill:{PAPER};stroke:{PAPER}}}}}</style>\n'
        f'  <path d="{MARK_PATH}" fill="{RED}" stroke="{RED}" stroke-width="{STROKE_WIDTH}" stroke-linejoin="round"/>\n'
        f'  <path class="r" d="{MARK_PATH}" stroke-width="{STROKE_WIDTH}" stroke-linejoin="round" transform="rotate(180 32 32)"/>\n</svg>\n')
    print("marks + favicon + app icon: 7 arquivos")


# ---- wordmark outlines + lockups: dependem da Barlow Condensed 600 ----
def build_wordmark():
    try:
        from fontTools.pens.boundsPen import BoundsPen
        from fontTools.pens.svgPathPen import SVGPathPen
        from fontTools.pens.transformPen import TransformPen
        from fontTools.ttLib import TTFont
    except ImportError as e:
        raise SystemExit(
            f"make_logo.py: falta a dependência '{e.name}'.\n"
            "  Os símbolos e o favicon já foram gerados; o wordmark e os lockups não.\n"
            "  Instale com:\n"
            "    python3 -m venv .venv\n"
            "    .venv/bin/pip install -r docs/design/canvas/generate/requirements.txt"
        ) from e

    if not os.path.exists(FONT):
        raise SystemExit(
            f"make_logo.py: fonte não encontrada em {FONT}.\n"
            "  Os símbolos e o favicon já foram gerados; o wordmark e os lockups não.\n"
            "  A fonte é versionada — restaure-a com 'git checkout -- docs/design/canvas/generate/fonts',\n"
            "  ou rebaixe-a seguindo docs/design/canvas/generate/fonts/README.md."
        )

    font = TTFont(FONT)
    upem = font["head"].unitsPerEm
    cmap = font.getBestCmap()
    glyphs = font.getGlyphSet()
    hmtx = font["hmtx"]

    def wordmark_path(size):
        """Return (path_d, width, ymin, ymax) for TEXT at font-size `size` px, baseline at y=0, y-down."""
        s = size / upem
        pen = SVGPathPen(glyphs)
        bpen = BoundsPen(glyphs)
        x = 0.0
        for ch in TEXT:
            gname = cmap[ord(ch)]
            adv = hmtx[gname][0]
            tp = TransformPen(pen, (s, 0, 0, -s, x, 0))
            glyphs[gname].draw(tp)
            tb = TransformPen(bpen, (s, 0, 0, -s, x, 0))
            glyphs[gname].draw(tb)
            x += adv * s + TRACKING * size
        xmin, ymin, xmax, ymax = bpen.bounds
        return pen.getCommands(), xmin, xmax, ymin, ymax

    # Standalone wordmark at 100px font-size, tight viewBox with 4px padding
    d, xmin, xmax, ymin, ymax = wordmark_path(100)
    pad = 4
    W = round(xmax - xmin + 2 * pad, 2); H = round(ymax - ymin + 2 * pad, 2)
    body = f'<path transform="translate({round(pad - xmin, 3)} {round(pad - ymin, 3)})" d="{d}" fill="{INK}"/>'
    open(f"{OUT}/kumite-wordmark.svg", "w").write(svg(W, H, body, title="kumite"))
    open(f"{OUT}/kumite-wordmark-paper.svg", "w").write(svg(W, H, body.replace(INK, PAPER), title="kumite"))
    print("wordmark", W, H, "ascender/descender", round(ymin, 1), round(ymax, 1))

    # ---- lockups: mark 64 + gap 20 + wordmark at 55px, vertically centered on the mark ----
    FS = 55
    d, xmin, xmax, ymin, ymax = wordmark_path(FS)
    tx = 64 + 20 - xmin
    ty = 32 - (ymin + ymax) / 2   # center the glyph box on the mark's center line
    LW = round(64 + 20 + (xmax - xmin), 2)

    def lockup(left, right, ink, bg=None, padx=0, pady=0):
        w = round(LW + 2 * padx, 2); h = 64 + 2 * pady
        body = (f'<g transform="translate({padx} {pady})">' + mark_paths(left, right) +
                f'<path transform="translate({round(tx, 3)} {round(ty, 3)})" d="{d}" fill="{ink}"/></g>')
        return svg(w, h, body, bg=bg)

    open(f"{OUT}/kumite-lockup-horizontal.svg", "w").write(lockup(RED, INK, INK))
    open(f"{OUT}/kumite-lockup-horizontal-dark.svg", "w").write(lockup(RED, PAPER, PAPER))
    open(f"{OUT}/kumite-lockup-horizontal-on-paper.svg", "w").write(lockup(RED, INK, INK, bg=LIGHTBG, padx=32, pady=24))
    open(f"{OUT}/kumite-lockup-horizontal-on-ink.svg", "w").write(lockup(RED, PAPER, PAPER, bg=INK, padx=32, pady=24))
    # stacked: mark 64 centered above wordmark at 48px
    FS2 = 48
    d2, x2min, x2max, y2min, y2max = wordmark_path(FS2)
    tw = x2max - x2min
    SW = round(max(64, tw) + 2 * 8, 2)
    mark_dx = (SW - 64) / 2
    text_dx = (SW - tw) / 2 - x2min
    text_dy = 64 + 14 - y2min
    SH = round(64 + 14 + (y2max - y2min) + 8, 2)

    def stacked(left, right, ink, bg=None):
        body = mark_paths(left, right, dx=round(mark_dx, 3)) + f'<path transform="translate({round(text_dx, 3)} {round(text_dy, 3)})" d="{d2}" fill="{ink}"/>'
        return svg(SW, SH, body, bg=bg)

    open(f"{OUT}/kumite-lockup-stacked.svg", "w").write(stacked(RED, INK, INK))
    open(f"{OUT}/kumite-lockup-stacked-dark.svg", "w").write(stacked(RED, PAPER, PAPER))
    print("lockup", LW, "stacked", SW, SH)


if __name__ == "__main__":
    build_marks()
    build_wordmark()
    print(sorted(os.listdir(OUT)))
