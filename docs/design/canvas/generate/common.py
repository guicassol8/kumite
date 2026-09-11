# Shared tokens, CSS, icons and component helpers for the kumite identity canvas.

from check_tokens import contrast
from mark import mark_svg

# As fontes são servidas de generate/fonts/, por caminho relativo ao artboard —
# nunca de fonts.googleapis.com. Antes da #227 era um <link> para o Google, e
# offline os 14 PNGs de ../screens/ saíam em Arial Narrow sem erro nenhum. A
# proveniência de cada arquivo está em generate/fonts/README.md.
# font-display: block para o shot.mjs nunca fotografar o fallback.
def _face(family, file, weight, style="normal"):
    return (f"@font-face{{font-family:'{family}';font-style:{style};font-weight:{weight};"
            f"font-display:block;src:url('generate/fonts/{file}') format('woff2');}}")

FONT_FACES = "".join([
    _face("Barlow Condensed", "BarlowCondensed-Medium.woff2", 500),
    _face("Barlow Condensed", "BarlowCondensed-SemiBold.woff2", 600),
    _face("Barlow Condensed", "BarlowCondensed-Bold.woff2", 700),
    _face("Barlow Condensed", "BarlowCondensed-ExtraBold.woff2", 800),
    _face("Barlow", "Barlow-Regular.woff2", 400),
    _face("Barlow", "Barlow-Medium.woff2", 500),
    _face("Barlow", "Barlow-SemiBold.woff2", 600),
    # Variáveis: um arquivo cobre a faixa inteira de peso.
    _face("JetBrains Mono", "JetBrainsMono-Variable.woff2", "100 800"),
])

# Variante A "Hinomaru" — vermilion + tinta + papel quente (recomendada)
LIGHT = dict(
    background="#FCFAF7", background2="#F2F0EC", card="#FFFFFF", surface="#F2F0EC",
    foreground="#1C1716", foreground2="#2A2523", muted="#69615D", border="#E1DDDA",
    primary="#1C1716", primary_fg="#FCFAF7",
    brand="#DD2824", brand_text="#DD2824", brand_on_chrome="#F45246", brand_hover="#CE2320",
    brand_soft="#FBE5E1", brand_fg="#FFFFFF", ring="#DD2824",
    destructive="#C1133A", destructive_soft="#FBE7EC", success="#008433", success_soft="#E3F5EA",
    warning="#ECAA0B", warning_text="#A06700", warning_soft="#FBF1D6",
    chrome="#1C1716", chrome_fg="#F3F1EF", chrome_muted="#9D9792", chrome_border="#312D2C",
)
DARK = dict(
    background="#120F0D", background2="#1B1716", card="#1B1716", surface="#282322",
    foreground="#F3F1EF", foreground2="#E6E2DE", muted="#9D9792", border="#312D2C",
    primary="#F3F1EF", primary_fg="#1C1716",
    brand="#DD2824", brand_text="#F45246", brand_on_chrome="#F45246", brand_hover="#CE2320",
    brand_soft="#3A1A18", brand_fg="#FFFFFF", ring="#DD2824",
    destructive="#EF5C7B", destructive_soft="#3A1520", success="#3DBA6A", success_soft="#12301C",
    warning="#F5C044", warning_text="#F5C044", warning_soft="#3A2E10",
    chrome="#0E0C0B", chrome_fg="#F3F1EF", chrome_muted="#9D9792", chrome_border="#312D2C",
)

BLOCKS = dict(logic="#2A75BA", loops="#298646", math="#6B64BA", text="#008282",
              lists="#8E57A5", variables="#A76700", root="#2A2523", input="#DD2824")

def readable_on(bg):
    """Tinta ou papel sobre bg, o que contrastar mais. Substitui a lista de hex
    escritos à mão, que não sabia de um token novo (o degrau #282322 do escuro)."""
    return "#FFFFFF" if contrast("#FFFFFF", bg) >= contrast("#1C1716", bg) else "#1C1716"


# Anel de foco — uma definição só, a mesma de identity.md § 5 e de tokens.css:
# borda de 1 px em ring + halo de 3 px em ring/50. brand-soft é fundo de linha
# e halo, nunca o indicador de foco.
FOCUS_RING = ("border-color: var(--ring); "
              "box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring) 50%, transparent);")

def vars_block(t):
    return "\n".join(f"  --{k.replace('_','-')}: {v};" for k, v in t.items())

CSS = """
:root {
%s
  --font-display: 'Barlow Condensed', 'Arial Narrow', 'Roboto Condensed', sans-serif;
  --font-body: 'Barlow', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  --radius: 6px;
}
.dark {
%s
}
html, body { height: 100%%; }
body { margin: 0; font-family: var(--font-body); color: var(--foreground); background: var(--background); font-size: 15px; line-height: 1.5; -webkit-font-smoothing: antialiased; }
a { color: inherit; text-decoration: none; } a:hover { color: var(--brand-text); }
* { box-sizing: border-box; }
.screen { width: 100%%; min-height: 100%%; display: flex; flex-direction: column; background: var(--background); color: var(--foreground); }
.display { font-family: var(--font-display); }
.h1 { font-family: var(--font-display); font-weight: 700; font-size: 36px; line-height: 1; letter-spacing: 0.01em; text-transform: uppercase; margin: 0; }
.h2 { font-family: var(--font-display); font-weight: 600; font-size: 24px; line-height: 1.1; margin: 0; }
.h3 { font-family: var(--font-display); font-weight: 600; font-size: 19px; line-height: 1.15; margin: 0; }
.eyebrow { font-family: var(--font-display); font-weight: 600; font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
.muted { color: var(--muted); }
.small { font-size: 13px; }
.mono { font-family: var(--font-mono); font-size: 13px; }
.num { font-family: var(--font-display); font-variant-numeric: tabular-nums; }
.card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; }
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 36px; padding: 0 14px; border-radius: var(--radius); font-family: var(--font-body); font-weight: 500; font-size: 14px; line-height: 1; border: 1px solid transparent; white-space: nowrap; cursor: pointer; }
.btn-sm { height: 30px; padding: 0 10px; font-size: 13px; }
.btn-lg { height: 44px; padding: 0 20px; font-size: 15px; }
.btn-primary { background: var(--primary); color: var(--primary-fg); }
.btn-brand { background: var(--brand); color: var(--brand-fg); }
.btn-outline { background: transparent; color: var(--foreground); border-color: var(--border); }
.btn-ghost { background: transparent; color: var(--foreground); }
.btn-destructive { background: transparent; color: var(--destructive); border-color: var(--destructive); }
.btn-chrome { background: transparent; color: var(--chrome-fg); border-color: var(--chrome-border); }
.btn svg { width: 16px; height: 16px; }
.input { height: 36px; padding: 0 12px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--card); color: var(--foreground); font-family: var(--font-body); font-size: 14px; display: flex; align-items: center; }
.input-lg { height: 44px; }
.label { font-size: 13px; font-weight: 500; color: var(--foreground); }
.badge { display: inline-flex; align-items: center; gap: 6px; height: 22px; padding: 0 8px; border-radius: 999px; font-size: 12px; font-weight: 500; line-height: 1; border: 1px solid var(--border); color: var(--foreground); background: transparent; white-space: nowrap; }
.badge-solid { background: var(--primary); color: var(--primary-fg); border-color: var(--primary); }
.badge-brand { background: var(--brand); color: var(--brand-fg); border-color: var(--brand); }
.badge-success { color: var(--success); border-color: var(--success); }
.badge-muted { color: var(--muted); }
.badge-uni { font-family: var(--font-display); font-weight: 600; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; height: 20px; padding: 0 6px; border-radius: 4px; }
.dot { width: 8px; height: 8px; border-radius: 999px; background: var(--brand); display: inline-block; }
.live { display: inline-flex; align-items: center; gap: 8px; font-family: var(--font-display); font-weight: 600; font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--brand-text); }
.table { width: 100%%; border-collapse: collapse; }
.table th { text-align: left; font-family: var(--font-display); font-weight: 600; font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); padding: 10px 12px; border-bottom: 1px solid var(--border); }
.table td { padding: 12px 12px; border-bottom: 1px solid var(--border); font-size: 14px; vertical-align: middle; }
.table tr:last-child td { border-bottom: 0; }
.seg { display: inline-flex; border: 1px solid var(--border); border-radius: var(--radius); padding: 2px; gap: 2px; background: var(--background2); }
.seg span { padding: 0 10px; height: 26px; display: inline-flex; align-items: center; border-radius: 4px; font-size: 13px; font-weight: 500; color: var(--muted); }
.seg span.on { background: var(--card); color: var(--foreground); box-shadow: 0 1px 2px rgba(0,0,0,.08); }
.seg.chrome { border-color: var(--chrome-border); background: transparent; }
.seg.chrome span { color: var(--chrome-muted); }
.seg.chrome span.on { background: var(--chrome-fg); color: var(--chrome); box-shadow: none; }
.tabs { display: flex; gap: 24px; border-bottom: 1px solid var(--border); }
.tabs span { padding: 10px 0 12px; font-size: 14px; font-weight: 500; color: var(--muted); border-bottom: 2px solid transparent; margin-bottom: -1px; }
.tabs span.on { color: var(--foreground); border-bottom-color: var(--brand-text); }
.alert { display: flex; gap: 12px; align-items: flex-start; padding: 12px 14px; border: 1px solid var(--border); border-radius: 8px; background: var(--card); font-size: 14px; }
.alert svg { width: 18px; height: 18px; flex: none; margin-top: 1px; }
.alert-error { border-color: var(--destructive); } .alert-error svg { color: var(--destructive); }
.alert-success { border-color: var(--success); } .alert-success svg { color: var(--success); }
.chrome-bar { background: var(--chrome); color: var(--chrome-fg); border-bottom: 1px solid var(--chrome-border); }
.chrome-bar a { color: var(--chrome-fg); }
.chrome-bar .muted { color: var(--chrome-muted); }
.footer { background: var(--chrome); color: var(--chrome-muted); border-top: 1px solid var(--chrome-border); font-size: 13px; }
.footer a { color: var(--chrome-fg); text-decoration: underline; text-underline-offset: 3px; }
.swatch { border-radius: 8px; border: 1px solid rgba(0,0,0,.06); }
.kbd { font-family: var(--font-mono); font-size: 12px; padding: 2px 6px; border: 1px solid var(--border); border-radius: 4px; background: var(--background2); }
""" % (vars_block(LIGHT), vars_block(DARK))

# ---------- SVG symbol: "dois blocos em guarda" ----------
# A geometria mora em mark.py e em nenhum outro lugar — ver a #227.
def mark(size=32, left=None, right=None, extra=""):
    """Two mirrored block silhouettes (tab + notch) facing each other across an 8-unit gap."""
    return mark_svg(size, left, right, extra)

def wordmark(size=24, color="var(--chrome-fg)"):
    return (f'<span style="font-family: var(--font-display); font-weight: 600; font-size: {size}px; '
            f'letter-spacing: -0.01em; line-height: 1; color: {color};">kumite</span>')

def lockup(size=28, color="var(--chrome-fg)", right=None):
    return (f'<div style="display: flex; align-items: center; gap: 8px;">{mark(size, right=right or color)}{wordmark(int(size*0.86), color)}</div>')

# ---------- Icons (stroke, 24 grid) ----------
def icon(name, size=16, color="currentColor", sw=2):
    d = {
        "play": '<path d="M7 5v14l11-7z"></path>',
        "check": '<path d="M5 13l4 4L19 7"></path>',
        "x": '<path d="M6 6l12 12M18 6L6 18"></path>',
        "xcircle": '<circle cx="12" cy="12" r="9"></circle><path d="M9 9l6 6M15 9l-6 6"></path>',
        "checkcircle": '<circle cx="12" cy="12" r="9"></circle><path d="M8.5 12.5l2.5 2.5 4.5-5"></path>',
        "chevl": '<path d="M15 6l-6 6 6 6"></path>',
        "chevr": '<path d="M9 6l6 6-6 6"></path>',
        "chevd": '<path d="M6 9l6 6 6-6"></path>',
        "sun": '<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"></path>',
        "moon": '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"></path>',
        "plus": '<path d="M12 5v14M5 12h14"></path>',
        "minus": '<path d="M5 12h14"></path>',
        "target": '<circle cx="12" cy="12" r="8"></circle><circle cx="12" cy="12" r="2"></circle><path d="M12 2v3M12 19v3M2 12h3M19 12h3"></path>',
        "trash": '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"></path>',
        "expand": '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"></path>',
        "collapse": '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"></path>',
        "users": '<circle cx="9" cy="8" r="3.5"></circle><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-5-6.3"></path>',
        "eye": '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"></path><circle cx="12" cy="12" r="3"></circle>',
        "panel": '<rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M9 4v16"></path>',
        "logout": '<path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9"></path>',
        "flag": '<path d="M5 21V4M5 4h12l-2 4 2 4H5"></path>',
        "timer": '<circle cx="12" cy="13" r="8"></circle><path d="M12 9v4l3 2M9 2h6"></path>',
        "send": '<path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"></path>',
        "grip": '<circle cx="9" cy="6" r="1.2"></circle><circle cx="15" cy="6" r="1.2"></circle><circle cx="9" cy="12" r="1.2"></circle><circle cx="15" cy="12" r="1.2"></circle><circle cx="9" cy="18" r="1.2"></circle><circle cx="15" cy="18" r="1.2"></circle>',
        "wifi": '<path d="M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0"></path><circle cx="12" cy="19" r="1"></circle>',
        "globe": '<circle cx="12" cy="12" r="9"></circle><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"></path>',
        "arrow": '<path d="M5 12h14M13 6l6 6-6 6"></path>',
        "bug": '<path d="M18 11v3a6 6 0 0 1-12 0v-3a6 6 0 0 1 12 0z"></path><path d="M9 6.2a3 3 0 0 1 6 0M12 20v-9M3 10h3M18 10h3M3.5 5.5 6 7.5M20.5 5.5 18 7.5M3.5 17.5 6 15.5M20.5 17.5 18 15.5"></path>',
        "key": '<circle cx="7.5" cy="15.5" r="4.5"></circle><path d="M10.7 12.3 21 2M17 6l3 3M14 9l3 3"></path>',
        "menu": '<path d="M4 7h16M4 12h16M4 17h16"></path>',
    }[name]
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="{color}" '
            f'stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{d}</svg>')

# ---------- App chrome ----------
# O inventário do header e do rodapé é lista fechada — identity.md § 5. O que
# está aqui é o que a #217 constrói, e nada além disso.

USER_NAME, USER_EMAIL = "Ana Souza", "ana.souza@edu.pucrs.br"

def user_menu_panel(name, email):
    """Dropdown do menu do usuário: nome e e-mail no topo, 'Trocar senha' como
    único item. Idioma, tema e Sair NÃO entram aqui — continuam na barra."""
    # Cartão claro sobre a barra carvão: as cores vão explícitas porque
    # '.chrome-bar .muted' pintaria o e-mail de chrome-muted sobre papel.
    return ('<div class="card" style="position: absolute; top: 40px; right: 0; width: 264px; z-index: 20; box-shadow: 0 8px 24px rgba(0,0,0,.28); overflow: hidden;">'
            '<div style="padding: 12px 14px; border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 2px;">'
            f'<span style="font-size: 14px; font-weight: 600; color: var(--foreground);">{name}</span>'
            f'<span style="font-size: 12px; color: var(--muted);">{email}</span></div>'
            '<div style="padding: 6px;">'
            f'<span style="display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 6px; font-size: 14px; font-weight: 500; color: var(--foreground); background: var(--background2);">{icon("key", 16, "var(--muted)")}Trocar senha</span>'
            '</div></div>')

def header(mode="participant", round_chip=True, name=USER_NAME, theme="light", compact=False, menu_open=False):
    """Charcoal header shared by every screen. mode: anon | participant | organizer."""
    links = ""
    if mode == "organizer":
        links += '<a href="#" style="font-size: 14px; font-weight: 500;">Organizador</a>'
    if mode in ("participant", "organizer"):
        links += ('<a href="#" style="font-size: 14px; font-weight: 500;">Times</a>'
                  '<a href="#" style="font-size: 14px; font-weight: 500;">Placar</a>')
    chip = ""
    if round_chip and mode != "anon":
        chip = ('<div style="display: flex; align-items: center; gap: 10px; padding: 0 12px; height: 32px; border: 1px solid var(--chrome-border); border-radius: 6px;">'
                '<span class="live"><span class="dot"></span>Rodada 2</span>'
                '<span class="num" style="font-weight: 600; font-size: 18px; color: var(--chrome-fg); letter-spacing: 0.02em;">41:07</span>'
                '</div>')
    right = ""
    if mode == "anon":
        right = ('<a href="#" style="font-size: 14px; font-weight: 500;">Entrar</a>'
                 '<a href="#" class="btn btn-sm" style="background: var(--chrome-fg); color: var(--chrome);">Cadastrar</a>')
    else:
        # Ícone de reportar bug: só ícone, com nome acessível — o FAB do canto
        # não existe em largura nenhuma (#198, #217).
        bug = ('<span title="Reportar um problema" style="display: inline-flex; width: 30px; height: 30px; align-items: center; justify-content: center; '
               f'border: 1px solid var(--chrome-border); border-radius: 6px; color: var(--chrome-fg);">{icon("bug", 16)}</span>')
        # Gatilho do menu do usuário: nome truncado + chevron, no lugar do
        # e-mail solto que ficava aqui antes.
        trigger = ('<span style="position: relative; display: inline-flex;">'
                   '<span style="display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 10px; border-radius: 6px; '
                   f'border: 1px solid {"var(--chrome-border)" if menu_open else "transparent"}; background: {"rgba(255,255,255,.06)" if menu_open else "transparent"};">'
                   f'<span style="font-size: 13px; font-weight: 500; color: var(--chrome-fg); max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{name}</span>'
                   f'{icon("chevd", 14, "var(--chrome-muted)")}</span>'
                   f'{user_menu_panel(name, USER_EMAIL) if menu_open else ""}</span>')
        right = (bug + trigger +
                 f'<a href="#" class="btn btn-sm btn-chrome">{icon("logout", 14)}Sair</a>')
    theme_icon = icon("moon" if theme == "light" else "sun", 16)
    pad = "0 16px" if compact else "0 24px"
    return (f'<header class="chrome-bar" style="display: flex; align-items: center; justify-content: space-between; gap: 16px; height: 56px; padding: {pad}; flex: none;">'
            f'<div style="display: flex; align-items: center; gap: 28px;">{lockup(26)}'
            f'<nav style="display: flex; align-items: center; gap: 20px;">{links}</nav></div>'
            f'<div style="display: flex; align-items: center; gap: 12px;">{chip}{right}'
            f'<div class="seg chrome"><span class="on">PT</span><span>ES</span><span>EN</span></div>'
            f'<span style="display: inline-flex; width: 30px; height: 30px; align-items: center; justify-content: center; border: 1px solid var(--chrome-border); border-radius: 6px; color: var(--chrome-fg);">{theme_icon}</span>'
            f'</div></header>')

def api_status(state="ok"):
    """Indicador de status da API: ponto MAIS rótulo. A § 3 proíbe cor como
    única pista, então o rótulo não é decorativo."""
    color, label = {"ok": ("var(--success)", "Conectado"),
                    "down": ("var(--destructive)", "Sem conexão"),
                    "wait": ("var(--chrome-muted)", "Conectando")}[state]
    return (f'<span style="display: inline-flex; align-items: center; gap: 8px;">'
            f'<span class="dot" style="background: {color};"></span>'
            f'<span style="color: var(--chrome-fg);">{label}</span></span>')

def footer(compact=False, status="ok"):
    pad = "12px 16px" if compact else "14px 24px"
    return (f'<footer class="footer" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: {pad}; flex: none; margin-top: auto;">'
            f'<span>Dúvidas? Fale com a organização: <a href="#">ligadealgoritmos@gmail.com</a></span>'
            f'{api_status(status)}'
            f'<span style="display: flex; align-items: center; gap: 8px;">{mark(16, right="var(--chrome-fg)")}<span style="font-family: var(--font-display); letter-spacing: 0.1em; text-transform: uppercase; font-size: 12px; font-weight: 600; color: var(--chrome-muted);">PUCRS × Mérida 2026</span></span>'
            f'</footer>')

def uni(u):
    return (f'<span class="badge badge-uni">{"PUCRS" if u == "pucrs" else "Mérida"}</span>')

def page(title, body, dark=False, extra_css="", width=None, script=None):
    cls = "dark" if dark else ""
    w = f"width: {width}px; " if width else ""
    scr = f"\n<script data-dc-script data-props='{script[0]}'>\n{script[1]}\n</script>" if script else ""
    return f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <title>{title}</title>
  <style>{FONT_FACES}</style>
  <style>{CSS}{extra_css}</style>
</helmet>
<div class="screen {cls}" style="{w}">
{body}
</div>
</x-dc>{scr}
</body>
</html>
"""
