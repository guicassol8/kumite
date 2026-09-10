from common import *

RANKS = [("Los Recursivos", "merida", 100, 100, 150, 350, False), ("Byte Fighters", "pucrs", 100, 100, 100, 300, True),
         ("Kernel Panic", "pucrs", 100, 60, 100, 260, False), ("Pila de Ideas", "merida", 100, 100, None, 200, False),
         ("Tupi Code", "pucrs", 80, None, 0, 80, False), ("Mérida Devs", "merida", 40, None, None, 40, False)]

def score(v, big=False):
    fs = "28px" if big else "16px"
    if v is None: return f'<span class="muted" style="font-size: {fs};">—</span>'
    return f'<span class="num" style="font-weight: 600; font-size: {fs};">{v}</span>'

def rank_rows(big=False):
    rows = ""
    for i, (name, u, a, b, c, tot, mine) in enumerate(RANKS, 1):
        rc = "var(--brand)" if i == 1 else ("var(--foreground)" if i <= 3 else "var(--muted)")
        fs = "36px" if big else "20px"
        nm = "26px" if big else "15px"
        badge = ' <span class="badge badge-brand" style="margin-left: 10px;">Seu time</span>' if (mine and not big) else ""
        style = ' style="background: var(--brand-soft);"' if (mine and not big) else ""
        rows += (f'<tr{style}><td><span class="num" style="font-weight: 700; font-size: {fs}; color: {rc};">{i}</span></td>'
                 f'<td style="font-weight: 500; font-size: {nm};"><span style="display: inline-flex; align-items: center; gap: 10px;">{name}{uni(u)}{badge}</span></td>'
                 f'<td>{score(a, big)}</td><td>{score(b, big)}</td><td>{score(c, big)}</td>'
                 f'<td><span class="num" style="font-weight: 700; font-size: {"36px" if big else "20px"};">{tot}</span></td></tr>')
    return rows

def leaderboard():
    body = (header("participant") +
            '<main style="flex: 1; padding: 32px 24px; display: flex; justify-content: center;"><div style="width: 100%; max-width: 1040px; display: flex; flex-direction: column; gap: 20px;">'
            '<div style="display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap;">'
            '<div style="display: flex; align-items: center; gap: 20px;"><h1 class="h1">Placar</h1><div class="seg"><span class="on">Rodada</span><span>Geral</span></div></div>'
            f'<div style="display: flex; align-items: center; gap: 12px;"><span class="live"><span class="dot"></span>Ao vivo · Rodada 2</span><span class="num" style="font-weight: 600; font-size: 24px; letter-spacing: 0.02em;">41:07</span><span class="btn btn-outline">{icon("expand", 16)}Modo telão</span></div></div>'
            '<div class="card" style="overflow: hidden;"><table class="table" style="table-layout: fixed;"><colgroup><col style="width: 64px;"><col><col style="width: 90px;"><col style="width: 90px;"><col style="width: 90px;"><col style="width: 110px;"></colgroup>'
            '<thead><tr><th>#</th><th>Time</th><th>A</th><th>B</th><th>C</th><th>Total</th></tr></thead>'
            f'<tbody>{rank_rows()}</tbody></table></div>'
            '<div style="display: flex; flex-wrap: wrap; gap: 8px 24px; font-size: 13px;" class="muted"><span><b style="color: var(--foreground); font-family: var(--font-display); font-size: 14px;">A</b> Soma dos Pares</span><span><b style="color: var(--foreground); font-family: var(--font-display); font-size: 14px;">B</b> Maior Valor da Lista</span><span><b style="color: var(--foreground); font-family: var(--font-display); font-size: 14px;">C</b> Contar Números Negativos</span><span style="margin-left: auto;">— sem submissão · 0 zerou</span></div>'
            '</div></main>' + footer())
    return page("Placar", body)

def telao():
    body = ('<div style="flex: 1; display: flex; flex-direction: column; padding: 40px 64px 32px; gap: 28px;">'
            '<div style="display: flex; align-items: flex-end; justify-content: space-between; gap: 24px;">'
            f'<div style="display: flex; align-items: center; gap: 24px;">{mark(64, right="var(--foreground)")}<div style="display: flex; flex-direction: column;"><span class="display" style="font-weight: 800; font-size: 84px; line-height: 0.9; letter-spacing: 0.01em; text-transform: uppercase;">Placar</span><span class="eyebrow" style="font-size: 18px; margin-top: 8px;">PUCRS × Mérida · programação em blocos</span></div></div>'
            '<div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;"><span class="live" style="font-size: 20px;"><span class="dot" style="width: 12px; height: 12px;"></span>Rodada 2 · ao vivo</span><span class="num" style="font-weight: 700; font-size: 96px; line-height: 0.9; letter-spacing: 0.02em; color: var(--brand-text);">41:07</span></div></div>'
            '<table class="table" style="table-layout: fixed;"><colgroup><col style="width: 90px;"><col><col style="width: 140px;"><col style="width: 140px;"><col style="width: 140px;"><col style="width: 180px;"></colgroup>'
            '<thead><tr><th style="font-size: 18px;">#</th><th style="font-size: 18px;">Time</th><th style="font-size: 18px;">A</th><th style="font-size: 18px;">B</th><th style="font-size: 18px;">C</th><th style="font-size: 18px;">Total</th></tr></thead>'
            f'<tbody>{rank_rows(big=True)}</tbody></table>'
            f'<div style="margin-top: auto; display: flex; justify-content: space-between; align-items: center;" class="muted"><span style="font-size: 18px;"><b style="color: var(--foreground); font-family: var(--font-display);">A</b> Soma dos Pares &nbsp;&nbsp; <b style="color: var(--foreground); font-family: var(--font-display);">B</b> Maior Valor da Lista &nbsp;&nbsp; <b style="color: var(--foreground); font-family: var(--font-display);">C</b> Contar Números Negativos</span><span style="display: inline-flex; align-items: center; gap: 10px; font-size: 16px;">{icon("collapse", 18)}<span class="kbd">Esc</span> sair do modo telão</span></div>'
            '</div>')
    return page("Placar — modo telão", body, dark=True, extra_css=".table td { padding: 14px 12px; border-bottom-color: var(--border); } .badge-uni { font-size: 14px; height: 26px; padding: 0 8px; }")

def organizer():
    def stat(title, num, lines, action=""):
        ls = "".join(f'<span class="muted small">{l}</span>' for l in lines)
        return (f'<div class="card" style="padding: 20px 22px; display: flex; flex-direction: column; gap: 10px;"><span class="eyebrow">{title}</span>'
                f'<span class="num" style="font-weight: 700; font-size: 44px; line-height: 1;">{num}</span><div style="display: flex; flex-direction: column; gap: 2px;">{ls}</div>{action}</div>')
    round_card = (f'<div class="card" style="padding: 20px 22px; display: flex; flex-direction: column; gap: 10px; border-color: var(--brand);"><span class="live"><span class="dot"></span>Rodada aberta</span>'
                  f'<span class="h2">Rodada 2</span><span class="num" style="font-weight: 700; font-size: 44px; line-height: 1; color: var(--brand-text);">41:07</span>'
                  f'<span class="muted small">3 problemas · 137 submissões · 21 times</span>'
                  f'<div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px;"><span class="btn btn-sm btn-primary">Gerenciar rodadas</span><span class="btn btn-sm btn-outline">Ver classificação</span></div></div>')
    podium = "".join(f'<div style="display: flex; align-items: center; gap: 12px; padding: 8px 0; border-top: 1px solid var(--border);"><span class="num" style="font-weight: 700; font-size: 22px; width: 28px; color: {"var(--brand)" if i == 1 else "var(--foreground)"};">{i}</span><span style="font-weight: 500; flex: 1;">{n}</span>{uni(u)}<span class="num" style="font-weight: 600; font-size: 18px;">{s} pts</span></div>'
                     for i, (n, u, s) in enumerate([("Los Recursivos", "merida", 350), ("Byte Fighters", "pucrs", 300), ("Kernel Panic", "pucrs", 260)], 1))
    shortcuts = "".join(f'<a href="#" style="display: flex; align-items: center; justify-content: space-between; padding: 9px 0; border-top: 1px solid var(--border); font-weight: 500;">{n}{icon("arrow", 16, "var(--muted)")}</a>'
                        for n in ["Problemas", "Rodadas", "Usuários", "Configuração do evento"])
    body = (header("organizer", email="Organização") +
            '<main style="flex: 1; padding: 24px 24px; display: flex; justify-content: center;"><div style="width: 100%; max-width: 1120px; display: flex; flex-direction: column; gap: 16px;">'
            '<h1 class="h1">Área do organizador</h1>'
            '<div class="tabs"><span class="on">Visão geral</span><span>Problemas</span><span>Rodadas</span><span>Configuração do evento</span><span>Times</span><span>Usuários</span></div>'
            '<div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px;">'
            + stat("Inscritos", "84", ["52 da PUCRS", "32 de Mérida"])
            + stat("Times", "21", ["63 de 84 inscritos em times", "5 vagas livres · 21 sem time"])
            + stat("Submissões", "137", ["nesta rodada", "94 na última rodada"])
            + round_card +
            '</div>'
            '<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px;">'
            f'<div class="card" style="padding: 20px 22px; display: flex; flex-direction: column;"><div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;"><span class="h3">Última rodada encerrada · Rodada 1</span><span class="muted small">Encerrada em 08/09/2026</span></div>{podium}</div>'
            f'<div class="card" style="padding: 20px 22px; display: flex; flex-direction: column;"><span class="h3" style="margin-bottom: 6px;">Atalhos</span>{shortcuts}</div>'
            '</div></div></main>' + footer())
    return page("Painel do organizador", body)

def home():
    body = (header("participant") +
            '<main style="flex: 1; padding: 48px 24px 32px; display: flex; justify-content: center;"><div style="width: 100%; max-width: 880px; display: flex; flex-direction: column; gap: 28px;">'
            f'<div style="display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center;">{mark(88, right="var(--foreground)")}<span class="display" style="font-weight: 600; font-size: 72px; line-height: 0.9; letter-spacing: -0.01em;">kumite</span><span class="eyebrow" style="font-size: 15px;">PUCRS × Mérida — programação em blocos</span></div>'
            '<div class="card" style="border-color: var(--brand); padding: 22px 26px; display: flex; align-items: center; justify-content: space-between; gap: 20px;">'
            '<div style="display: flex; flex-direction: column; gap: 6px;"><span class="live"><span class="dot"></span>Rodada aberta</span><span class="h2" style="font-size: 30px;">Rodada 2</span><span class="muted">3 problemas · termina em <span class="num" style="font-weight: 600; color: var(--foreground); font-size: 17px;">41:07</span></span></div>'
            f'<span class="btn btn-brand btn-lg">Ver rodada{icon("arrow", 16)}</span></div>'
            '<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px;">'
            f'<div class="card" style="padding: 20px 22px; display: flex; flex-direction: column; gap: 10px;"><span class="eyebrow">Seu time</span><span class="h2">Byte Fighters</span><span class="muted small">3 de 4 integrantes · <span style="color: var(--foreground);">#2</span> na Rodada 1</span><div><span class="btn btn-sm btn-outline">Ver times</span></div></div>'
            '<div class="card" style="padding: 20px 22px; display: flex; flex-direction: column; gap: 10px;"><span class="eyebrow">Rodadas encerradas</span>'
            '<div style="display: flex; flex-direction: column;">'
            '<a href="#" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-top: 1px solid var(--border);"><span style="font-weight: 500;">Rodada 1</span><span class="muted small">#2 · 300 pts · 08/09/2026</span></a>'
            '<a href="#" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-top: 1px solid var(--border);"><span style="font-weight: 500;">Aquecimento</span><span class="muted small">#4 · 100 pts · 01/09/2026</span></a>'
            '</div></div></div>'
            '</div></main>' + footer())
    return page("Início", body)
