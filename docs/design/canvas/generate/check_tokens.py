#!/usr/bin/env python3
"""Confere a camada de tokens de docs/design. stdlib puro, sem dependências.

Cinco checagens, nesta ordem:

  1. paridade   — tokens.css e kumite.tokens.json declaram o mesmo conjunto de
                  tokens semânticos com os mesmos valores;
  2. oklch      — o oklch(...) anotado ao lado de cada hex converte de volta
                  para aquele hex exato;
  3. gamut      — todo oklch citado cai dentro do gamut sRGB;
  4. contraste  — a tabela de contraste de identity.md §3 bate, par a par, com
                  o que os tokens rendem, no valor e no nível;
  5. gerador    — common.LIGHT/DARK/BLOCKS, a quarta cópia dos mesmos hex,
                  bate com tokens.css.

Uso: python3 docs/design/canvas/generate/check_tokens.py
Sai com 0 se tudo passa, 1 na primeira checagem que falha.
"""

import json
import math
import re
import sys
from pathlib import Path

DESIGN = Path(__file__).resolve().parents[2]
CSS = DESIGN / "tokens" / "tokens.css"
JSON_TOKENS = DESIGN / "tokens" / "kumite.tokens.json"
IDENTITY = DESIGN / "identity.md"


# --------------------------------------------------------------------------
# cor: oklch <-> sRGB e contraste WCAG 2.x
# --------------------------------------------------------------------------

def oklch_to_linear(L, C, h):
    a = C * math.cos(math.radians(h))
    b = C * math.sin(math.radians(h))
    l_ = L + 0.3963377774 * a + 0.2158037573 * b
    m_ = L - 0.1055613458 * a - 0.0638541728 * b
    s_ = L - 0.0894841775 * a - 1.2914855480 * b
    l, m, s = l_ ** 3, m_ ** 3, s_ ** 3
    return (
        4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
    )


def _encode(c):
    c = max(0.0, min(1.0, c))
    return 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055


def oklch_to_hex(L, C, h):
    lin = oklch_to_linear(L, C, h)
    return "#%02X%02X%02X" % tuple(round(_encode(c) * 255) for c in lin)


def oklch_in_gamut(L, C, h, tol=0.0005):
    """Fora do gamut sRGB o navegador clipa, e a cor deixa de bater com o hex
    gêmeo usado nos SVGs do logo e nos --block-*."""
    return all(-tol <= c <= 1 + tol for c in oklch_to_linear(L, C, h))


def _decode(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_to_linear(hx):
    hx = hx.lstrip("#")
    return tuple(_decode(int(hx[i:i + 2], 16) / 255) for i in (0, 2, 4))


def hex_to_oklch(hx):
    r, g, b = hex_to_linear(hx)
    l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l_, m_, s_ = l ** (1 / 3), m ** (1 / 3), s ** (1 / 3)
    L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_
    A = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_
    B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
    return L, math.hypot(A, B), math.degrees(math.atan2(B, A)) % 360


def oklch_spelling(hx):
    """A grafia oklch() mais curta que converte de volta para este hex."""
    L, C, h = hex_to_oklch(hx)
    for dl in (2, 3, 4):
        for dc in (3, 4):
            for dh in (0, 1, 2):
                cand = (round(L, dl), round(C, dc), round(h, dh))
                if oklch_to_hex(*cand) == hx.upper():
                    return "%g %g %g" % cand
    return "%.4f %.4f %.2f" % (L, C, h)


def luminance(hx):
    r, g, b = hex_to_linear(hx)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a, b):
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def mix(fg, bg, alpha):
    """fg com opacidade alpha sobre bg — o que Tailwind escreve como fg/90."""
    f, b = fg.lstrip("#"), bg.lstrip("#")
    return "#%02X%02X%02X" % tuple(
        round(int(f[i:i + 2], 16) * alpha + int(b[i:i + 2], 16) * (1 - alpha))
        for i in (0, 2, 4)
    )


# --------------------------------------------------------------------------
# leitura dos arquivos
# --------------------------------------------------------------------------

DECL = re.compile(r"^\s*--([\w-]+):\s*([^;]+);(?:\s*/\*(.*?)\*/)?", re.S)
OKLCH = re.compile(r"oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)")
HEX = re.compile(r"^#[0-9A-Fa-f]{6}$")


def parse_css():
    """-> (blocos, comentarios) com os blocos :root / .dark / :root dos blocos."""
    text = CSS.read_text(encoding="utf-8")
    blocks, comments = {}, {}
    for header, body in re.findall(r"(:root|\.dark|@theme inline)\s*\{(.*?)\n\}", text, re.S):
        name = header.strip()
        for line in body.splitlines():
            m = DECL.match(line)
            if not m:
                continue
            prop, value, comment = m.group(1), m.group(2).strip(), (m.group(3) or "")
            key = "block" if prop.startswith("block-") else name
            blocks.setdefault(key, {})[prop] = value
            comments[(key, prop)] = comment
    return blocks, comments


def resolve_css(blocks, block_name):
    """.dark herda de :root tudo o que não redeclara; var(--x) vira o valor."""
    layer = dict(blocks.get(":root", {}))
    if block_name != ":root":
        layer.update(blocks.get(block_name, {}))
    out = {}
    for prop in layer:
        value, seen = layer[prop], set()
        while value.startswith("var(--"):
            ref = value[6:].rstrip(")").strip()
            if ref in seen:
                raise SystemExit(f"ciclo de var() em --{prop}")
            seen.add(ref)
            value = layer.get(ref, value)
            if ref not in layer:
                break
        out[prop] = value
    return out


def parse_json_tokens():
    data = json.loads(JSON_TOKENS.read_text(encoding="utf-8"))

    def get(path):
        node = data
        for part in path.split("."):
            node = node[part]
        return node

    def resolve(value):
        seen = 0
        while isinstance(value, str) and value.startswith("{"):
            value = get(value.strip("{}"))["$value"]
            seen += 1
            if seen > 10:
                raise SystemExit(f"ciclo de alias em {value}")
        return value

    groups = {}
    for group in ("light", "dark", "block"):
        groups[group] = {
            name: resolve(node["$value"]).upper()
            for name, node in data["color"][group].items()
            if isinstance(node, dict) and "$value" in node
        }
    radius = {
        name: node["$value"]["value"]
        for name, node in data["radius"].items()
        if isinstance(node, dict) and "$value" in node
    }
    return groups, radius


def parse_identity_table():
    """As linhas da tabela de contraste de identity.md §3 -> [(par, razao, nivel)]."""
    text = IDENTITY.read_text(encoding="utf-8")
    section = re.search(r"### Contraste.*?\n(\|.*?)\n\n", text, re.S)
    if not section:
        return None
    rows = []
    for line in section.group(1).splitlines():
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) != 3 or set(cells[0]) <= set("-: "):
            continue
        if cells[0] == "Par":
            continue
        rows.append(tuple(cells))
    return rows


# --------------------------------------------------------------------------
# os pares que a spec manda usar — a tabela de identity.md tem de ser esta
# --------------------------------------------------------------------------

# kind: "texto" (AA 4,5 / AAA 7) · "ui" (AA 3:1 — foco, ícone que informa
# sozinho) · "decorativo" (sem mínimo: reforço visual, nunca a única pista).
PAIRS = [
    ("tinta sobre papel", [("light.foreground", "light.background")], "texto"),
    ("cinza texto sobre papel / cartão",
     [("light.muted-foreground", "light.background"),
      ("light.muted-foreground", "light.card")], "texto"),
    ("branco sobre vermelho faixa (botão)",
     [("light.brand-foreground", "light.brand")], "texto"),
    ("vermelho faixa como texto sobre papel",
     [("light.brand-text", "light.background")], "texto"),
    ("dificuldade no claro: verde / âmbar-texto / crimson sobre cartão",
     [("light.success", "light.card"),
      ("light.warning-text", "light.card"),
      ("light.destructive", "light.card")], "texto"),
    ("crimson sobre papel — cheio / `/90`",
     [("light.destructive", "light.background"),
      ("mix(light.destructive, light.background, 0.9)", "light.background")], "texto"),
    ("âmbar vivo sobre papel — preenchimento e borda, nunca ícone sozinho",
     [("light.warning", "light.background")], "decorativo"),
    ("tinta sobre vermelho-suave (fundo de linha)",
     [("light.foreground", "light.brand-soft")], "texto"),
    ("anel de foco (`ring`) sobre papel / cartão",
     [("light.ring", "light.background"), ("light.ring", "light.card")], "ui"),
    ("anel de foco (`ring`) sobre cartão escuro / superfície de estado",
     [("dark.ring", "dark.card"), ("dark.ring", "dark.muted")], "ui"),
    ("`brand-on-chrome` sobre chrome claro / escuro",
     [("light.brand-on-chrome", "light.chrome"),
      ("dark.brand-on-chrome", "dark.chrome")], "texto"),
    ("chrome-muted sobre chrome", [("light.chrome-muted", "light.chrome")], "texto"),
    ("escuro: papel-texto sobre fundo / cartão",
     [("dark.foreground", "dark.background"), ("dark.foreground", "dark.card")], "texto"),
    ("escuro: brand-text sobre fundo / cartão",
     [("dark.brand-text", "dark.background"), ("dark.brand-text", "dark.card")], "texto"),
    ("escuro: papel-texto sobre vermelho-suave (fundo de linha)",
     [("dark.foreground", "dark.brand-soft")], "texto"),
    ("escuro: destructive sobre cartão — cheio / `/90`",
     [("dark.destructive", "dark.card"),
      ("mix(dark.destructive, dark.card, 0.9)", "dark.card")], "texto"),
    ("escuro: dificuldade verde / âmbar / crimson sobre cartão",
     [("dark.success", "dark.card"), ("dark.warning", "dark.card"),
      ("dark.destructive", "dark.card")], "texto"),
    ("escuro: texto / texto secundário sobre a superfície de estado",
     [("dark.foreground", "dark.muted"), ("dark.muted-foreground", "dark.muted")], "texto"),
    ("escuro: cartão ↔ superfície de estado (degrau de hover/seleção)",
     [("dark.card", "dark.muted")], "decorativo"),
    ("hairline sobre papel / cartão / cartão escuro",
     [("light.border", "light.background"), ("light.border", "light.card"),
      ("dark.border", "dark.card")], "decorativo"),
    ("borda de controle de formulário sobre papel / cartão escuro",
     [("light.input", "light.background"), ("dark.input", "dark.card")], "decorativo"),
    ("texto branco sobre cada bloco do editor (menor / maior)",
     [("#FFFFFF", "block.logic"), ("#FFFFFF", "block.loops"),
      ("#FFFFFF", "block.math"), ("#FFFFFF", "block.text"),
      ("#FFFFFF", "block.lists"), ("#FFFFFF", "block.variables")], "texto-faixa"),
    ("texto papel sobre o bloco resolver",
     [("dark.foreground", "block.root")], "texto"),
]

MIX = re.compile(r"^mix\(([\w.-]+),\s*([\w.-]+),\s*([\d.]+)\)$")


class MissingToken(Exception):
    pass


def resolve_ref(ref, groups):
    if HEX.match(ref):
        return ref.upper()
    m = MIX.match(ref)
    if m:
        return mix(resolve_ref(m.group(1), groups), resolve_ref(m.group(2), groups),
                   float(m.group(3)))
    group, name = ref.split(".", 1)
    try:
        return groups[group][name]
    except KeyError:
        raise MissingToken(ref)


def level_for(kind, ratios):
    worst = min(ratios)
    if kind == "decorativo":
        return "decorativo"
    if kind == "ui":
        return "AA" if worst >= 3 else f"REPROVA ({worst:.2f} < 3)"
    if worst >= 7:
        return "AAA"
    if worst >= 4.5:
        return "AA"
    return f"REPROVA ({worst:.2f} < 4,5)"


def expected_table(groups):
    rows = []
    for label, refs, kind in PAIRS:
        try:
            ratios = [contrast(resolve_ref(f, groups), resolve_ref(b, groups)) for f, b in refs]
        except MissingToken as missing:
            rows.append((label, "?", f"TOKEN AUSENTE ({missing})"))
            continue
        shown = [min(ratios), max(ratios)] if kind == "texto-faixa" else ratios
        sep = " – " if kind == "texto-faixa" else " / "
        value = sep.join(f"{r:.1f}".replace(".", ",") for r in shown)
        rows.append((label, value, level_for(kind, ratios)))
    return rows


# --------------------------------------------------------------------------
# checagens
# --------------------------------------------------------------------------

NON_COLOR = re.compile(r"^(radius|font|color)")


def check_parity(css_blocks, groups, radius):
    errors = []
    for layer, group in ((":root", "light"), (".dark", "dark"), ("block", "block")):
        css = resolve_css(css_blocks, layer) if layer != "block" else dict(css_blocks.get("block", {}))
        css = {k[6:] if layer == "block" else k: v for k, v in css.items()
               if not NON_COLOR.match(k) or layer == "block"}
        want = groups[group]
        only_css = sorted(set(css) - set(want))
        only_json = sorted(set(want) - set(css))
        for name in only_css:
            errors.append(f"{group}: --{name} está em tokens.css e falta em kumite.tokens.json")
        for name in only_json:
            errors.append(f"{group}: {name} está em kumite.tokens.json e falta em tokens.css")
        for name in sorted(set(css) & set(want)):
            got = css[name].upper()
            if not HEX.match(got):
                errors.append(f"{group}: --{name} não resolve para hex (valor: {css[name]})")
            elif got != want[name]:
                errors.append(f"{group}: --{name} = {got} em tokens.css, {want[name]} no JSON")
    css_radius = {k[7:]: v for k, v in css_blocks.get(":root", {}).items()
                  if k.startswith("radius-")}
    for name, px in sorted(css_radius.items()):
        want = radius.get(name)
        got = float(px.rstrip("px"))
        if want is None:
            errors.append(f"radius: --radius-{name} está em tokens.css e falta no JSON")
        elif float(want) != got:
            errors.append(f"radius: --radius-{name} = {px} em tokens.css, {want}px no JSON")
    for name in sorted(set(radius) - set(css_radius) - {"control", "card", "pill"}):
        errors.append(f"radius: {name} está no JSON e falta em tokens.css")
    return errors


HEX_ANYWHERE = re.compile(r"#[0-9A-Fa-f]{6}\b")

# Quanto um oklch pode passar do cubo sRGB, em linear, antes de contar como
# fora do gamut. Os oklch tirados por inversão de um hex passam no máximo
# 0,0007 (arredondamento da grafia curta); os que de fato estavam fora
# passavam de 0,0067 a 0,028 — uma ordem de grandeza de folga dos dois lados.
GAMUT_TOLERANCE = 0.002


def declared_pairs(css_blocks, comments):
    """Cada declaração como (camada, prop, oklch, hex) — o oklch e o hex podem
    vir do valor ou do comentário, em qualquer ordem: o que importa é que os
    dois descrevam a mesma cor."""
    for (layer, prop), comment in sorted(comments.items()):
        value = css_blocks[layer][prop].strip()
        text = f"{value} /* {comment} */"
        found_oklch = OKLCH.search(text)
        found_hex = HEX_ANYWHERE.search(text)
        if not found_oklch:
            continue
        triple = tuple(float(x) for x in found_oklch.groups())
        yield layer, prop, triple, (found_hex.group(0).upper() if found_hex else None)


def check_oklch(css_blocks, comments):
    errors = []
    for layer, prop, triple, hx in declared_pairs(css_blocks, comments):
        if hx is None:
            errors.append(
                f"--{prop} ({layer}): oklch({' '.join('%g' % x for x in triple)}) "
                f"sem o hex gêmeo — declare o hex e deixe o oklch no comentário"
            )
            continue
        rendered = oklch_to_hex(*triple)
        if rendered != hx:
            errors.append(
                f"--{prop} ({layer}): oklch({' '.join('%g' % x for x in triple)}) "
                f"rende {rendered}, mas o hex declarado é {hx} — "
                f"o oklch de {hx} é oklch({oklch_spelling(hx)})"
            )
    return errors


def check_gamut(css_blocks, comments):
    """O oklch anotado tem de descrever a MESMA cor do hex sem depender de
    clipagem. Um oklch fora do gamut só vira aquele hex porque o navegador
    clipa em sRGB — em tela P3 ele não clipa, e aí a cor diverge do hex gêmeo
    usado nos --block-* e nos SVGs do logo. A conversão inversa de um hex de
    borda (canal em 0 ou 255) cai microscopicamente fora ao ser arredondada
    para a grafia curta; é isso que a tolerância cobre."""
    errors = []
    for layer, prop, triple, hx in declared_pairs(css_blocks, comments):
        raw = oklch_to_linear(*triple)
        overshoot = max(max(-c, c - 1, 0.0) for c in raw)
        if overshoot > GAMUT_TOLERANCE:
            errors.append(
                f"--{prop} ({layer}): oklch({' '.join('%g' % x for x in triple)}) "
                f"cai {overshoot:.4f} fora do gamut sRGB em linear — só vira "
                f"{hx} porque o navegador clipa; puxe o croma para dentro"
            )
    return errors


def gamut_edge_tokens(css_blocks, comments):
    """Tokens cujo hex encosta na superfície do gamut sRGB (algum canal em 00
    ou FF): não sobra croma nenhum: qualquer aumento sai do gamut. Não é erro
    — identity.md os anota."""
    edge = []
    for layer, prop, _, hx in declared_pairs(css_blocks, comments):
        if hx and any(hx[i:i + 2].upper() in ("00", "FF") for i in (1, 3, 5)):
            edge.append(f"--{prop} ({layer}) = {hx}")
    return edge


def check_contrast(groups):
    want = expected_table(groups)
    got = parse_identity_table()
    if got is None:
        return ["identity.md: não achei a tabela de contraste em § Contraste"]
    errors = []
    for label, value, level in want:
        row = next((r for r in got if r[0] == label), None)
        if row is None:
            errors.append(f"identity.md: falta a linha | {label} | {value} | {level} |")
        elif (row[1], row[2]) != (value, level):
            errors.append(
                f"identity.md: '{label}' está como {row[1]} / {row[2]}, medido {value} / {level}"
            )
        if level.startswith(("REPROVA", "TOKEN AUSENTE")):
            errors.append(f"contraste: '{label}' {level}")
    for row in got:
        if not any(row[0] == label for label, _, _ in want):
            errors.append(f"identity.md: linha '{row[0]}' não corresponde a nenhum par da spec")
    return errors


# --------------------------------------------------------------------------
# 5. o gerador do canvas é uma QUARTA cópia dos mesmos hex
# --------------------------------------------------------------------------

# common.py repete à mão os valores de tokens.css, e as quatro checagens acima
# não alcançam essa cópia. Foi por aí que um valor sobreviveu: depois de
# --destructive do escuro virar #EF5C7B, o board da paleta continuava mostrando
# #E8496A. Corrigido na #225; esta checagem fecha a classe.

# (1) Mapa de nomes — o gerador usa vocabulário próprio, e a correspondência
# precisa ser explícita, não por convenção: o `muted` dele é o
# `muted-foreground` do tokens.css, e o `surface` dele é o `muted`.
GENERATOR_NAMES = {
    "background2": "background-2",
    "muted": "muted-foreground",
    "surface": "muted",
    "primary_fg": "primary-foreground",
    "brand_fg": "brand-foreground",
    "chrome_fg": "chrome-foreground",
}

# (2) Allowlist — chaves que só existem no gerador, sem token correspondente:
# fundos de badge dos artboards e o degrau `foreground2`. Acrescentar um nome
# aqui é decisão consciente (o valor deixa de ser conferido), e tirar um token
# desta lista sem tirá-lo do gerador também é erro: uma allowlist obsoleta
# volta a esconder divergência.
GENERATOR_ONLY = {"foreground2", "destructive_soft", "success_soft", "warning_soft"}


def _css_name(key):
    return GENERATOR_NAMES.get(key, key.replace("_", "-"))


def check_generator(css_blocks):
    # common.py faz `from check_tokens import contrast`, então o import mora
    # aqui dentro — no topo do módulo seria circular.
    import common

    errors = []
    layers = ((":root", "claro", common.LIGHT), (".dark", "escuro", common.DARK))
    for layer, label, table in layers:
        css = resolve_css(css_blocks, layer)
        for key in sorted(table):
            if key in GENERATOR_ONLY:
                continue
            name = _css_name(key)
            if name not in css:
                errors.append(
                    f"{label}: common.py tem '{key}' e tokens.css não tem --{name} — "
                    f"mapeie o nome em GENERATOR_NAMES ou declare-o em GENERATOR_ONLY"
                )
                continue
            got, want = table[key].upper(), css[name].upper()
            if got != want:
                errors.append(
                    f"{label}: common.py tem {key} = {got}, tokens.css tem --{name} = {want}"
                )
    for key in sorted(GENERATOR_ONLY):
        name = _css_name(key)
        if name in resolve_css(css_blocks, ":root"):
            errors.append(
                f"allowlist obsoleta: '{key}' virou o token --{name} em tokens.css — "
                f"tire-o de GENERATOR_ONLY para que o valor volte a ser conferido"
            )
    blocks_css = {k[6:]: v for k, v in css_blocks.get("block", {}).items()}
    for key in sorted(common.BLOCKS):
        if key not in blocks_css:
            errors.append(f"blocos: common.BLOCKS tem '{key}' e tokens.css não tem --block-{key}")
            continue
        got, want = common.BLOCKS[key].upper(), blocks_css[key].upper()
        if got != want:
            errors.append(
                f"blocos: common.BLOCKS[{key!r}] = {got}, tokens.css tem --block-{key} = {want}"
            )
    for key in sorted(set(blocks_css) - set(common.BLOCKS)):
        errors.append(f"blocos: tokens.css tem --block-{key} e common.BLOCKS não")
    return errors


def main():
    css_blocks, comments = parse_css()
    groups, radius = parse_json_tokens()

    checks = [
        ("1. paridade tokens.css ↔ kumite.tokens.json", check_parity(css_blocks, groups, radius)),
        ("2. o oklch do comentário rende o hex declarado", check_oklch(css_blocks, comments)),
        ("3. o oklch descreve o hex sem depender de clipagem em sRGB",
         check_gamut(css_blocks, comments)),
        ("4. tabela de contraste de identity.md § 3", check_contrast(groups)),
        ("5. common.py (gerador do canvas) ↔ tokens.css", check_generator(css_blocks)),
    ]

    failed = False
    for title, errors in checks:
        if errors:
            failed = True
            print(f"✗ {title} — {len(errors)} problema(s)")
            for err in errors:
                print(f"    {err}")
        else:
            print(f"✓ {title}")

    if failed:
        print("\nTabela de contraste medida (copiar para identity.md § 3):\n")
        print("| Par | Razão | Nível |")
        print("|---|---|---|")
        for label, value, level in expected_table(groups):
            print(f"| {label} | {value} | {level} |")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
