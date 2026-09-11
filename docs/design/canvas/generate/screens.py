from common import *

BLK_CSS = """
.ws { position: relative; flex: 1; min-height: 0; background-color: var(--background2); background-image: radial-gradient(var(--border) 1.2px, transparent 1.2px); background-size: 20px 20px; border-radius: 0 8px 8px 0; overflow: hidden; }
.blk { display: inline-flex; flex-direction: column; align-items: stretch; border-radius: 5px; color: #fff; font-size: 13px; font-weight: 500; font-family: var(--font-body); box-shadow: inset 0 -2px 0 rgba(0,0,0,.18); }
.blk-row { display: flex; align-items: center; gap: 6px; padding: 6px 10px; white-space: nowrap; }
.blk-mouth { margin: 0 0 0 16px; padding: 4px 10px 4px 8px; background: var(--background2); border-radius: 0 0 0 4px; display: flex; flex-direction: column; gap: 4px; align-items: flex-start; }
.blk-foot { height: 10px; }
.fld { display: inline-flex; align-items: center; gap: 4px; background: rgba(255,255,255,.92); color: #1C1716; border-radius: 999px; padding: 2px 8px; font-size: 12px; font-weight: 500; }
.val { display: inline-flex; align-items: center; gap: 4px; border-radius: 999px; padding: 3px 10px; font-size: 12px; font-weight: 500; color: #fff; box-shadow: inset 0 -2px 0 rgba(0,0,0,.18); }
.cat { display: flex; align-items: center; gap: 10px; padding: 9px 12px 9px 0; font-size: 14px; font-weight: 500; color: var(--foreground); }
.cat i { display: block; width: 4px; height: 20px; border-radius: 2px; }
.zbtn { width: 32px; height: 32px; border-radius: 999px; background: var(--card); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; color: var(--muted); }
"""

def program():
    B = BLOCKS
    chev = icon("chevd", 10, "#1C1716")
    def fld(t): return f'<span class="fld">{t}{chev}</span>'
    def val(t, c): return f'<span class="val" style="background: {c};">{t}</span>'
    def valf(t, c): return f'<span class="val" style="background: {c};">{t}{icon("chevd", 10, "#fff")}</span>'
    inner_if = (f'<div class="blk" style="background: {B["logic"]};">'
                f'<div class="blk-row">se {val("resto da divisão de " + valf("numero", B["variables"]) + " ÷ " + val("2", B["math"]), B["math"])} {fld("=")} {val("0", B["math"])}</div>'
                f'<div class="blk-mouth"><div class="blk" style="background: {B["variables"]};"><div class="blk-row">definir {fld("soma")} para {val(valf("soma", B["variables"]) + " " + fld("+") + " " + valf("numero", B["variables"]), B["math"])}</div></div></div>'
                f'<div class="blk-foot"></div></div>')
    loop = (f'<div class="blk" style="background: {B["loops"]};">'
            f'<div class="blk-row">para cada item {fld("numero")} na lista {val("entrada", B["input"])}</div>'
            f'<div class="blk-mouth">{inner_if}</div>'
            f'<div class="blk-foot"></div></div>')
    root = (f'<div class="blk" style="background: {B["root"]}; color: #F3F1EF;">'
            f'<div class="blk-row" style="font-family: var(--font-display); font-size: 15px; font-weight: 600; letter-spacing: 0.02em; padding-bottom: 4px;">resolver <span class="muted" style="font-family: var(--font-body); font-weight: 400; font-size: 12px; color: #9D9792;">( entrada )</span></div>'
            f'<div class="blk-mouth"><div class="blk" style="background: {B["variables"]};"><div class="blk-row">definir {fld("soma")} para {val("0", B["math"])}</div></div>{loop}</div>'
            f'<div class="blk-row" style="padding-top: 8px;">retornar {valf("soma", B["variables"])}</div>'
            f'</div>')
    return root

def toolbox():
    cats = [("Lógica", "logic"), ("Laços", "loops"), ("Matemática", "math"), ("Texto", "text"), ("Listas", "lists"), ("Variáveis", "variables")]
    items = "".join(f'<div class="cat"><i style="background: {BLOCKS[c]};"></i>{n}</div>' for n, c in cats)
    return (f'<div style="width: 148px; flex: none; padding: 8px 0 8px 12px; border-right: 1px solid var(--border); display: flex; flex-direction: column; background: var(--card); border-radius: 8px 0 0 8px;">'
            f'<div class="eyebrow" style="padding: 4px 0 8px;">Blocos</div>{items}</div>')

def editor_body(dark=False, closed=False):
    theme = "dark" if dark else "light"
    results_rows = ""
    cases = [("[1, 2, 3, 4]", "6", "6"), ("[5, 7, 9]", "0", "0"), ("[2, 4, 6, 8]", "20", "20")]
    for i, (inp, exp, got) in enumerate(cases, 1):
        results_rows += (f'<div style="display: flex; align-items: center; gap: 12px; padding: 8px 12px; border-top: 1px solid var(--border);">'
                         f'{icon("checkcircle", 18, "var(--success)")}<span style="font-weight: 500; width: 56px;">Caso {i}</span>'
                         f'<span class="mono muted">{inp}</span><span class="muted" style="margin-left: auto; font-size: 13px;">esperado <span class="mono" style="color: var(--foreground);">{exp}</span></span>'
                         f'<span class="muted" style="font-size: 13px;">obtido <span class="mono" style="color: var(--foreground);">{got}</span></span></div>')
    statement = (
        '<aside class="card" style="width: 320px; flex: none; display: flex; flex-direction: column; min-height: 0;">'
        '<div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; padding: 16px 12px 12px 20px;">'
        '<div style="display: flex; flex-direction: column; gap: 8px;">'
        '<div style="display: flex; align-items: center; gap: 8px;"><span class="badge badge-success">Fácil</span><span class="badge">100 pts</span><span class="badge badge-muted">Problema A</span></div>'
        '<h2 class="h2">Soma dos Pares</h2></div>'
        f'<span class="zbtn" style="width: 28px; height: 28px; border-radius: 6px;">{icon("chevl", 14)}</span></div>'
        '<div style="padding: 0 20px 20px; display: flex; flex-direction: column; gap: 16px; overflow: auto; font-size: 14px;">'
        '<p style="margin: 0;">Receba uma lista de números inteiros e devolva a soma dos que são pares. Se não houver nenhum par, devolva 0.</p>'
        '<div style="display: flex; flex-direction: column; gap: 8px;"><span class="eyebrow">Casos de exemplo</span>'
        '<div style="display: grid; grid-template-columns: repeat(1, minmax(0, 1fr)); gap: 6px;">'
        + "".join(f'<div style="display: flex; justify-content: space-between; gap: 8px; padding: 8px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--background);"><span class="mono">{i}</span><span class="mono" style="color: var(--brand-text);">→ {o}</span></div>' for i, o, _ in cases)
        + '</div></div></div></aside>')
    workspace = (
        '<section style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 12px; min-height: 0;">'
        '<div class="card" style="flex: 1; min-height: 0; display: flex; overflow: hidden;">'
        + toolbox() +
        '<div class="ws"><div style="position: absolute; left: 48px; top: 40px;">' + program() + '</div>'
        f'<div style="position: absolute; right: 16px; top: 16px; display: flex; flex-direction: column; gap: 6px;"><span class="zbtn">{icon("plus", 14)}</span><span class="zbtn">{icon("minus", 14)}</span><span class="zbtn">{icon("target", 14)}</span></div>'
        f'<div style="position: absolute; right: 16px; bottom: 16px;"><span class="zbtn" style="width: 40px; height: 40px;">{icon("trash", 18)}</span></div>'
        '</div></div>'
        '<div class="card" style="flex: none; display: flex; flex-direction: column; max-height: 190px; overflow: hidden;">'
        '<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px;">'
        '<div style="display: flex; align-items: center; gap: 10px;"><span class="h3">Resultados</span><span class="badge badge-success">3/3 casos</span></div>'
        f'<span class="zbtn" style="width: 28px; height: 28px; border-radius: 6px;">{icon("chevd", 14)}</span></div>'
        f'{results_rows}</div>'
        '<div style="flex: none; display: flex; align-items: center; gap: 8px; padding-top: 4px;">'
        f'<span class="btn btn-outline">{icon("play", 16)}Executar</span>'
        f'<span class="btn btn-ghost" style="color: var(--destructive);">{icon("trash", 16)}Limpar blocos</span>'
        f'<span style="margin-left: auto;" class="muted small">Última execução há 5 s</span>'
        f'<span class="btn btn-brand">{icon("send", 16)}Submeter</span>'
        '</div></section>')
    body = (header("participant", theme=theme) +
            f'<main style="flex: 1; min-height: 0; display: flex; gap: 16px; padding: 16px 24px;">{statement}{workspace}</main>' +
            footer())
    return body

def editor(dark=False):
    return page("Editor de problema", editor_body(dark), dark=dark, extra_css=BLK_CSS)

# ---------- Login (desktop split) ----------
def login():
    poster = (
        '<section style="width: 560px; flex: none; background: var(--chrome); color: var(--chrome-fg); display: flex; flex-direction: column; justify-content: space-between; padding: 48px 56px;">'
        f'<div>{mark(112, right="var(--chrome-fg)")}</div>'
        '<div style="display: flex; flex-direction: column; gap: 18px;">'
        '<div class="display" style="font-weight: 700; font-size: 64px; line-height: 0.95; letter-spacing: 0.01em; text-transform: uppercase;">PUCRS <span style="color: var(--brand-text);">×</span> Mérida<br>programação<br>em blocos</div>'
        '<p style="margin: 0; max-width: 380px; font-size: 15px; color: var(--chrome-muted);">Monte a solução com blocos, submeta e acompanhe o placar ao vivo.</p>'
        '</div>'
        '<div class="eyebrow" style="color: var(--chrome-muted);">Evento online · 2026</div>'
        '</section>')
    form = (
        '<section style="flex: 1; display: flex; align-items: center; justify-content: center; padding: 40px;">'
        '<div style="width: 400px; display: flex; flex-direction: column; gap: 24px;">'
        '<div style="display: flex; flex-direction: column; gap: 6px;"><h1 class="h1" style="font-size: 40px;">Entrar</h1><span class="muted">Use o e-mail cadastrado com o código do evento.</span></div>'
        '<div style="display: flex; flex-direction: column; gap: 14px;">'
        '<div style="display: flex; flex-direction: column; gap: 6px;"><span class="label">E-mail</span><div class="input input-lg" style="color: var(--foreground);">ana.souza@edu.pucrs.br</div></div>'
        f'<div style="display: flex; flex-direction: column; gap: 6px;"><span class="label">Senha</span><div class="input input-lg" style="justify-content: space-between; {FOCUS_RING}"><span style="letter-spacing: 0.2em;">••••••••••</span>{icon("eye", 16, "var(--muted)")}</div></div>'
        '</div>'
        '<span class="btn btn-primary btn-lg" style="width: 100%;">Entrar</span>'
        '<div style="display: flex; justify-content: space-between; font-size: 14px;"><a href="#" class="muted" style="text-decoration: underline; text-underline-offset: 3px;">Esqueci minha senha</a><span class="muted">Sem conta? <a href="#" style="color: var(--foreground); font-weight: 500;">Cadastrar</a></span></div>'
        '</div></section>')
    body = header("anon", round_chip=False) + f'<main style="flex: 1; min-height: 0; display: flex;">{poster}{form}</main>' + footer()
    return page("Login", body)

# ---------- Cadastro (mobile 390) ----------
def signup_mobile():
    hdr = (f'<header class="chrome-bar" style="display: flex; align-items: center; justify-content: space-between; height: 56px; padding: 0 16px; flex: none;">{lockup(24)}'
           f'<div style="display: flex; align-items: center; gap: 10px;"><div class="seg chrome"><span class="on">PT</span><span>ES</span><span>EN</span></div>'
           f'<span style="display: inline-flex; width: 32px; height: 32px; align-items: center; justify-content: center; border: 1px solid var(--chrome-border); border-radius: 6px;">{icon("menu", 18, "var(--chrome-fg)")}</span></div></header>')
    def field(label, value, extra="", muted=False):
        col = "var(--muted)" if muted else "var(--foreground)"
        return (f'<div style="display: flex; flex-direction: column; gap: 6px;"><span class="label">{label}</span>'
                f'<div class="input input-lg" style="justify-content: space-between; color: {col};">{value}{extra}</div></div>')
    body = (hdr +
            '<main style="flex: 1; padding: 28px 20px 24px; display: flex; flex-direction: column; gap: 24px;">'
            '<div style="display: flex; flex-direction: column; gap: 6px;"><h1 class="h1" style="font-size: 36px;">Cadastro</h1><span class="muted">PUCRS × Mérida — programação em blocos</span></div>'
            '<div style="display: flex; flex-direction: column; gap: 14px;">'
            + field("Nome", "Luis Pech")
            + field("E-mail", "luis.pech@merida.edu.mx")
            + field("Senha", '<span style="letter-spacing: 0.2em;">••••••••••</span>', icon("eye", 16, "var(--muted)"))
            + '<div style="display: flex; flex-direction: column; gap: 6px;"><span class="label">Confirmar senha</span><div class="input input-lg" style="justify-content: space-between; border-color: var(--destructive);"><span style="letter-spacing: 0.2em;">••••••••</span>' + icon("eye", 16, "var(--muted)") + '</div><span class="small" style="color: var(--destructive);">As senhas não coincidem.</span></div>'
            + field("Código do evento", '<span class="mono" style="font-size: 14px; letter-spacing: 0.08em;">MERIDA2026</span>')
            + '</div>'
            '<span class="btn btn-primary btn-lg" style="width: 100%;">Cadastrar</span>'
            '<div style="text-align: center; font-size: 14px;" class="muted">Já tem conta? <a href="#" style="color: var(--foreground); font-weight: 500;">Entrar</a></div>'
            '</main>' + footer(compact=True))
    return page("Cadastro (celular)", body, extra_css=".footer { flex-direction: column; align-items: flex-start; }")

# ---------- Times ----------
def teams():
    members = [("Ana Souza", "ana.souza@edu.pucrs.br", "pucrs", True), ("João Lima", "joao.lima@edu.pucrs.br", "pucrs", False), ("Luis Pech", "luis.pech@merida.edu.mx", "merida", False)]
    mrows = "".join(
        f'<div style="display: flex; align-items: center; gap: 12px; padding: 10px 0; border-top: 1px solid var(--border);">'
        f'<span style="width: 32px; height: 32px; border-radius: 999px; background: var(--background2); display: inline-flex; align-items: center; justify-content: center; font-family: var(--font-display); font-weight: 600; font-size: 14px; color: var(--muted);">{n[0].upper()}</span>'
        f'<span style="display: flex; flex-direction: column; line-height: 1.25;"><span style="font-size: 14px; font-weight: 500;">{n}</span><span class="muted" style="font-size: 12px;">{e}</span></span>{uni(u)}{"<span class=\"muted small\">(você)</span>" if me else ""}</div>'
        for n, e, u, me in members)
    my = (f'<div class="card" style="padding: 20px 24px; display: flex; flex-direction: column; gap: 6px;">'
          f'<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;"><div style="display: flex; align-items: center; gap: 12px;"><span class="eyebrow">Meu time</span><span class="badge badge-solid">Byte Fighters</span><span class="muted small">3 de 4 integrantes</span></div>'
          f'<span class="btn btn-sm btn-destructive">{icon("logout", 14)}Sair do time</span></div>'
          f'<div style="display: flex; flex-direction: column; margin-top: 6px;">{mrows}</div></div>')
    teams_rows = [("Byte Fighters", 3, "pucrs,pucrs,merida", "mine"), ("Los Recursivos", 4, "merida,merida,pucrs,merida", "full"),
                  ("Kernel Panic", 2, "pucrs,merida", "open"), ("Tupi Code", 1, "pucrs", "open"), ("Pila de Ideas", 4, "merida,merida,merida,pucrs", "full")]
    trs = ""
    for name, n, unis, st in teams_rows:
        chips = "".join(uni(u) for u in unis.split(","))
        if st == "mine": action = '<span class="badge badge-brand">Seu time</span>'
        elif st == "full": action = '<span class="muted small">Cheio</span>'
        else: action = '<span class="btn btn-sm btn-outline">Entrar</span>'
        slots = f'<span class="num" style="font-weight: 600; font-size: 16px;">{4-n}/4</span>'
        trs += f'<tr><td style="font-weight: 500;">{name}</td><td><div style="display: flex; gap: 4px; align-items: center;"><span class="num" style="font-weight: 600; font-size: 16px; margin-right: 6px;">{n}</span>{chips}</div></td><td>{slots}</td><td style="text-align: right;">{action}</td></tr>'
    table = (f'<div class="card" style="overflow: hidden;"><table class="table"><thead><tr><th>Time</th><th>Integrantes</th><th>Vagas</th><th style="text-align: right;">Ações</th></tr></thead><tbody>{trs}</tbody></table></div>')
    body = (header("participant") +
            '<main style="flex: 1; padding: 32px 24px; display: flex; justify-content: center;"><div style="width: 100%; max-width: 1040px; display: flex; flex-direction: column; gap: 20px;">'
            f'<div style="display: flex; align-items: flex-end; justify-content: space-between; gap: 16px;"><div style="display: flex; flex-direction: column; gap: 4px;"><h1 class="h1">Times</h1><span class="muted">Times de até 4 pessoas. Mistura entre universidades liberada.</span></div><span class="btn btn-primary">{icon("plus", 16)}Criar time</span></div>'
            f'{my}{table}</div></main>' + footer())
    return page("Times", body)

# ---------- Painel de menu do celular (< 768 px) ----------
# O componente mais complexo da #217 e o que fecha o #186: abaixo do
# breakpoint a navegação, o usuário, tema, idioma, reportar bug e Sair moram
# todos aqui. Inventário em identity.md § 5.
def mobile_menu():
    hdr = (f'<header class="chrome-bar" style="display: flex; align-items: center; justify-content: space-between; height: 56px; padding: 0 16px; flex: none;">{lockup(24)}'
           f'<div style="display: flex; align-items: center; gap: 10px;"><div class="seg chrome"><span class="on">PT</span><span>ES</span><span>EN</span></div>'
           f'<span style="display: inline-flex; width: 32px; height: 32px; align-items: center; justify-content: center; border: 1px solid var(--chrome-fg); border-radius: 6px; background: rgba(255,255,255,.08);">{icon("x", 18, "var(--chrome-fg)")}</span></div></header>')
    def nav(label, on=False):
        col = "var(--chrome-fg)" if on else "var(--chrome-fg)"
        bar = "2px solid var(--brand-on-chrome)" if on else "2px solid transparent"
        return (f'<span style="display: flex; align-items: center; justify-content: space-between; padding: 13px 20px; border-left: {bar}; '
                f'font-size: 17px; font-weight: 500; color: {col};">{label}{icon("chevr", 18, "var(--chrome-muted)")}</span>')
    def row(ic, label, trailing=""):
        return (f'<span style="display: flex; align-items: center; gap: 12px; padding: 13px 20px; font-size: 15px; font-weight: 500; color: var(--chrome-fg);">'
                f'{icon(ic, 18, "var(--chrome-muted)")}<span style="flex: 1;">{label}</span>{trailing}</span>')
    rule = '<div style="height: 1px; background: var(--chrome-border); margin: 8px 0;"></div>'
    panel = ('<div style="flex: 1; background: var(--chrome); color: var(--chrome-fg); display: flex; flex-direction: column; padding: 8px 0 20px;">'
             # Bloco do usuário
             '<div style="display: flex; align-items: center; gap: 12px; padding: 12px 20px 16px;">'
             '<span style="width: 40px; height: 40px; border-radius: 999px; background: var(--chrome-border); display: inline-flex; align-items: center; justify-content: center; font-family: var(--font-display); font-weight: 600; font-size: 17px; color: var(--chrome-fg);">A</span>'
             '<span style="display: flex; flex-direction: column; line-height: 1.3;"><span style="font-size: 16px; font-weight: 600;">Ana Souza</span>'
             '<span style="font-size: 13px; color: var(--chrome-muted);">ana.souza@edu.pucrs.br</span></span></div>'
             # Chip da rodada
             '<div style="padding: 0 20px 12px;"><div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 0 14px; height: 44px; border: 1px solid var(--chrome-border); border-radius: 8px;">'
             '<span class="live"><span class="dot"></span>Rodada 2</span>'
             '<span class="num" style="font-weight: 600; font-size: 22px; color: var(--chrome-fg); letter-spacing: 0.02em;">41:07</span></div></div>'
             + rule
             + nav("Início", on=True) + nav("Times") + nav("Placar")
             + rule
             + row("moon", "Tema escuro", '<span style="display: inline-flex; width: 40px; height: 24px; border-radius: 999px; background: var(--chrome-border); align-items: center; padding: 0 3px;"><span style="width: 18px; height: 18px; border-radius: 999px; background: var(--chrome-fg);"></span></span>')
             + row("bug", "Reportar um problema")
             + rule
             + row("logout", "Sair")
             + '</div>')
    return page("Menu do celular", hdr + panel, extra_css=".screen { background: var(--chrome); }")
