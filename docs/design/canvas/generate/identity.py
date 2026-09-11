from common import *

BOARD = ".board { padding: 40px 48px; display: flex; flex-direction: column; gap: 28px; } .note { font-size: 13px; color: var(--muted); max-width: 520px; }"

def title_row(eyebrow, title, note=""):
    n = f'<span class="note">{note}</span>' if note else ""
    return f'<div style="display: flex; flex-direction: column; gap: 6px;"><span class="eyebrow">{eyebrow}</span><h1 class="h1" style="font-size: 32px;">{title}</h1>{n}</div>'

# ---------- Logo ----------
def logo_board():
    def tile(inner, bg, label, fg="var(--foreground)", h=150):
        return (f'<div style="display: flex; flex-direction: column; gap: 8px;"><div style="height: {h}px; border-radius: 10px; background: {bg}; border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; color: {fg};">{inner}</div><span class="muted small">{label}</span></div>')
    construction = (
        '<div style="display: flex; gap: 32px; align-items: center;">'
        f'<div style="position: relative; width: 256px; height: 256px; border-radius: 12px; background: var(--card); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center;">{mark(224, right="var(--foreground)")}'
        '<span style="position: absolute; left: 50%; top: 24px; width: 1px; height: 208px; background: var(--brand); opacity: .35; transform: translateX(-50%);"></span>'
        '<span class="mono" style="position: absolute; left: 50%; bottom: 6px; transform: translateX(-50%); font-size: 11px; color: var(--brand-text);">vão 8/64</span></div>'
        '<div style="display: flex; flex-direction: column; gap: 10px; max-width: 360px;"><span class="h3">Dois blocos em guarda</span>'
        '<p style="margin: 0; font-size: 14px;">Duas silhuetas de bloco idênticas — aba em cima, encaixe embaixo — giradas 180° uma em relação à outra, frente a frente, separadas por um vão de 8 unidades. Elas encaixariam; não encaixam. É o instante antes do primeiro movimento.</p>'
        '<p style="margin: 0; font-size: 14px;">Vermelho é sempre o bloco da esquerda; o da direita toma a cor do fundo oposto (tinta no papel, papel na tinta). Duas universidades, uma disputa.</p>'
        '<span class="muted small">Construção em grade 64 · bordas em 6,5 e 26,5 · cantos 3 via stroke-linejoin, que infla o path 1,5 por lado e deixa o vão renderizado em 8/64 · nunca girar a marca, nunca separar as cores.</span></div></div>')
    lockups = (
        '<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px;">'
        + tile(lockup(40, color="var(--foreground)"), "var(--background)", "Lockup horizontal · papel")
        + tile(lockup(40, color="var(--chrome-fg)"), "var(--chrome)", "Lockup horizontal · tinta", "var(--chrome-fg)")
        + tile(f'<div style="display: flex; flex-direction: column; align-items: center; gap: 10px;">{mark(64, right="var(--foreground)")}{wordmark(34, "var(--foreground)")}</div>', "var(--background)", "Lockup empilhado")
        + tile(f'<div style="display: flex; gap: 24px; align-items: center;">{mark(56, left="var(--brand)", right="var(--brand)")}{mark(56, left="var(--foreground)", right="var(--foreground)")}{mark(56, left="#F3F1EF", right="#F3F1EF", extra="style=\"background: var(--chrome); border-radius: 8px; padding: 4px;\"")}</div>', "var(--background)", "Monocromático · vermelho, tinta, invertido")
        + tile(f'<div style="display: flex; gap: 20px; align-items: flex-end;">{mark(16, right="var(--foreground)")}{mark(24, right="var(--foreground)")}{mark(32, right="var(--foreground)")}{mark(48, right="var(--foreground)")}</div>', "var(--background)", "Tamanhos mínimos · 16 (favicon) · 24 (header) · 32 · 48")
        + tile(f'<div style="display: flex; gap: 14px; align-items: center;"><span style="width: 48px; height: 48px; border-radius: 12px; background: var(--brand); display: inline-flex; align-items: center; justify-content: center;">{mark(32, left="#F3F1EF", right="#1C1716")}</span><span style="width: 48px; height: 48px; border-radius: 12px; background: var(--chrome); display: inline-flex; align-items: center; justify-content: center;">{mark(32, right="#F3F1EF")}</span><span style="width: 48px; height: 48px; border-radius: 999px; background: var(--card); border: 1px solid var(--border); display: inline-flex; align-items: center; justify-content: center;">{mark(30, right="var(--foreground)")}</span></div>', "var(--background)", "Ícone de app · avatar — exceção à Regra 1: aqui o vermelho é a placa, e os blocos são papel + tinta")
        + '</div>')
    body = f'<div class="board">{title_row("Identidade kumite · 01", "Símbolo e wordmark", "Símbolo vetorial canônico, gerado por generate/mark.py — é a marca da identidade v1.2, não um rascunho. O wordmark é Barlow Condensed 600, minúsculo, tracking −1%.")}{construction}{lockups}</div>'
    return page("Símbolo e wordmark", body, extra_css=BOARD)

# ---------- Paleta ----------
def palette_board():
    def sw(hex_, name, role, fg=None, h=88):
        fg = fg or readable_on(hex_)
        return (f'<div style="display: flex; flex-direction: column; gap: 6px; min-width: 0;"><div class="swatch" style="height: {h}px; background: {hex_}; color: {fg}; display: flex; align-items: flex-end; padding: 8px 10px;"><span class="mono" style="font-size: 12px;">{hex_}</span></div>'
                f'<span style="font-size: 13px; font-weight: 500; line-height: 1.2;">{name}</span><span class="muted" style="font-size: 12px; line-height: 1.3;">{role}</span></div>')
    # Os hex saem de LIGHT/DARK, que tokens.css confere: repetir o valor aqui foi
    # o que deixou o crimson do escuro parado no #E8496A depois da #225.
    light = [(LIGHT["background"], "Papel", "fundo das telas"), (LIGHT["background2"], "Papel 2", "superfícies mudas, grid do editor"), (LIGHT["card"], "Cartão", "cards, inputs, tabelas"),
             (LIGHT["border"], "Borda", "hairlines 1px"), (LIGHT["muted"], "Cinza texto", "texto secundário"), (LIGHT["foreground"], "Tinta", "texto, botão primário, chrome"),
             (LIGHT["brand"], "Vermelho faixa", "marca · Submeter · ao vivo · #1"), (LIGHT["brand_hover"], "Vermelho hover", "hover/pressed da marca"),
             (LIGHT["destructive"], "Crimson", "erro e destrutivo — só contorno e texto"), (LIGHT["success"], "Verde", "caso passou · publicado"), (LIGHT["warning"], "Âmbar", "só preenchimento e borda"), (LIGHT["warning_text"], "Âmbar-texto", "Médio · aviso em texto")]
    dark = [(DARK["background"], "Fundo escuro", "background"), (DARK["card"], "Cartão escuro", "cards e inputs"), (DARK["surface"], "Superfície de estado", "hover de linha, linha selecionada, botão fantasma"), (DARK["border"], "Borda escura", "hairlines"),
            (DARK["muted"], "Cinza escuro", "texto secundário"), (DARK["foreground"], "Papel-texto", "texto, botão primário"), (DARK["brand_text"], "Vermelho-texto (escuro)", "texto, timer, ao vivo; botões seguem " + DARK["brand"]),
            (DARK["destructive"], "Crimson (escuro)", "erro"), (DARK["success"], "Verde (escuro)", "ok"), (DARK["warning"], "Âmbar (escuro)", "aviso")]
    def mini(bg, chrome, brand, fg, name, note, border, tag="alternativa"):
        return (f'<div class="card" style="padding: 14px 16px; display: flex; flex-direction: column; gap: 10px;"><div style="display: flex; justify-content: space-between; align-items: baseline;"><span class="h3">{name}</span><span class="muted small">{tag}</span></div>'
                f'<div style="border-radius: 8px; overflow: hidden; border: 1px solid {border};"><div style="background: {chrome}; height: 34px; display: flex; align-items: center; padding: 0 12px; gap: 8px;">{mark(18, left=brand, right="#F3F1EF")}<span style="font-family: var(--font-display); font-weight: 600; font-size: 16px; color: #F3F1EF;">kumite</span></div>'
                f'<div style="background: {bg}; padding: 12px; display: flex; gap: 8px; align-items: center;"><span class="btn btn-sm" style="background: {chrome}; color: #F3F1EF;">Executar</span><span class="btn btn-sm" style="background: {brand}; color: #fff;">Submeter</span><span class="num" style="font-weight: 600; font-size: 18px; color: {brand}; margin-left: auto;">41:07</span></div></div>'
                f'<div style="display: flex; gap: 6px;">{"".join(f"<span class=\"swatch\" style=\"flex: 1; height: 22px; background: {c};\"></span>" for c in (bg, chrome, brand, fg))}</div>'
                f'<span class="muted" style="font-size: 12px; line-height: 1.4;">{note}</span></div>')
    body = (f'<div class="board">{title_row("Identidade kumite · 02", "Paleta — vermelho faixa + carvão", "Recomendação: variante A, Hinomaru — vermilion quente sobre papel levemente quente e tinta. Marca e erro são vermelhos diferentes (matiz 28° vs 18°) e nunca recebem o mesmo tratamento: marca é preenchimento, erro é contorno. Todos os pares texto/fundo passam WCAG AA (≥ 4,5:1).")}'
            f'<div style="display: flex; flex-direction: column; gap: 10px;"><span class="eyebrow">A · Hinomaru — modo claro</span><div style="display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 10px;">{"".join(sw(*s) for s in light)}</div></div>'
            f'<div style="display: flex; flex-direction: column; gap: 10px;"><span class="eyebrow">A · Hinomaru — modo escuro</span><div style="display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 10px;">{"".join(sw(*s, h=64) for s in dark)}</div></div>'
            f'<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; align-items: start;">'
            + mini("#FCFAF7", "#1C1716", "#DD2824", "#1C1716", "A · Hinomaru", "Sol vermelho, tinta sumi, papel. Quente sem ser creme; o mais 'dojo' dos três e o que melhor deixa os blocos coloridos respirarem.", "#E1DDDA", tag="recomendada")
            + mini("#F7F8FA", "#13161B", "#D40237", "#13161B", "B · Faixa preta", "Crimson frio sobre grafite. Mais Linear, mais 'produto'; perde o calor de pôster e o crimson chega perto demais do vermelho de erro.", "#DCDEE2")
            + mini("#FCFCFC", "#161616", "#EC4800", "#161616", "C · Brasa", "Vermelho-laranja em carvão neutro, âmbar como segundo acento. Mais festivo e legível no telão; lê menos como 'faixa vermelha', mais como laranja.", "#E5E5E5")
            + '</div></div>')
    return page("Paleta", body, extra_css=BOARD)

# ---------- Tipografia ----------
def type_board():
    props = '{"bodyFont":{"editor":"enum","default":"Barlow","options":["Barlow","Inter"],"section":"Tipografia"}}'
    logic = """class Component extends DCLogic {
  renderVals() {
    const f = this.props.bodyFont ?? 'Barlow';
    return { bodyFont: f === 'Inter' ? "'Inter', system-ui, sans-serif" : "'Barlow', 'Inter', system-ui, sans-serif", bodyName: f };
  }
}"""
    def row(label, sample, meta):
        return (f'<div style="display: grid; grid-template-columns: 180px minmax(0, 1fr) 220px; gap: 24px; align-items: baseline; padding: 16px 0; border-top: 1px solid var(--border);"><span class="eyebrow">{label}</span><div style="min-width: 0;">{sample}</div><span class="muted" style="font-size: 12px; line-height: 1.4;">{meta}</span></div>')
    body = (f'<div class="board">{title_row("Identidade kumite · 03", "Tipografia", "Barlow Condensed nos títulos, placar, timer e wordmark (energia de pôster); a Barlow regular no corpo — mesma família, mesmo ritmo, sem cara de Inter. Alterne o corpo para Inter no controle acima do artboard e compare; JetBrains Mono só em JSON e casos de teste.")}'
            '<div style="display: flex; flex-direction: column;">'
            + row("Display · telão", '<span class="display" style="font-weight: 800; font-size: 84px; line-height: 0.9; text-transform: uppercase; letter-spacing: 0.01em;">Placar <span style="color: var(--brand-text);">41:07</span></span>', "Barlow Condensed 800 · 84/76 · caixa-alta · tabular-nums no número")
            + row("H1 · título de página", '<span class="h1">Área do organizador</span>', "Barlow Condensed 700 · 36/36 · caixa-alta · tracking +1%")
            + row("H2 · card, problema", '<span class="h2">Soma dos Pares</span>', "Barlow Condensed 600 · 24/26 · caixa normal")
            + row("Eyebrow · rótulo", '<span class="eyebrow">Casos de exemplo</span>', "Barlow Condensed 600 · 13 · caixa-alta · tracking +12% · cinza")
            + row("Corpo", '<p style="margin: 0; font-size: 15px; line-height: 1.5; max-width: 560px; font-family: {{bodyFont}};">Receba uma lista de números inteiros e devolva a soma dos que são pares. Se não houver nenhum par, devolva 0. Cada time pode submeter quantas vezes quiser; vale a melhor pontuação.</p>', "Barlow ou Inter (alterne acima) · 400 · 15/22 · formulários e enunciados · 14 em tabelas")
            + row("UI · botões e rótulos", '<div style="display: flex; gap: 10px; align-items: center; font-family: {{bodyFont}};"><span class="btn btn-primary" style="font-family: inherit;">Criar time</span><span class="btn btn-outline" style="font-family: inherit;">Executar</span><span class="label" style="font-family: inherit;">Código do evento</span></div>', "Corpo 500 · 14 · botões 36px (44px em telas de toque)")
            + row("Números · placar", '<div style="display: flex; gap: 24px; align-items: baseline;"><span class="num" style="font-weight: 700; font-size: 44px; line-height: 1;">350</span><span class="num" style="font-weight: 600; font-size: 24px; color: var(--brand-text);">41:07</span><span class="num" style="font-weight: 600; font-size: 20px; color: var(--muted);">3/4</span></div>', "Barlow Condensed 600–700 · sempre font-variant-numeric: tabular-nums")
            + row("Mono · casos de teste", '<span class="mono">{ "entrada": [1, 2, 3, 4], "esperado": 6 }</span>', "JetBrains Mono 400 · 13/20")
            + '</div></div>')
    return page("Tipografia", body, extra_css=BOARD, script=(props, logic))

# ---------- Componentes ----------
def components_board():
    def col(dark):
        cls = "dark" if dark else ""
        def sec(label, inner):
            return f'<div style="display: flex; flex-direction: column; gap: 10px;"><span class="eyebrow">{label}</span><div style="display: flex; flex-wrap: wrap; gap: 10px; align-items: center;">{inner}</div></div>'
        btns = (f'<span class="btn btn-primary">Criar time</span><span class="btn btn-brand">{icon("send", 16)}Submeter</span><span class="btn btn-outline">{icon("play", 16)}Executar</span>'
                f'<span class="btn btn-ghost">Cancelar</span><span class="btn btn-destructive">Sair do time</span><span class="btn btn-sm btn-outline">Entrar</span>')
        inputs = (f'<div class="input" style="width: 180px; color: var(--muted);">E-mail</div><div class="input" style="width: 180px; {FOCUS_RING}">foco</div>'
                  f'<div style="display: flex; flex-direction: column; gap: 4px;"><div class="input" style="width: 180px; border-color: var(--destructive);">erro</div><span class="small" style="color: var(--destructive);">Informe o nome do time</span></div>')
        badges = ('<span class="badge badge-success">Fácil</span><span class="badge" style="color: var(--warning-text); border-color: var(--warning);">Médio</span><span class="badge" style="color: var(--destructive); border-color: var(--destructive);">Difícil</span>'
                  '<span class="badge badge-solid">Publicado</span><span class="badge badge-muted">Rascunho</span><span class="badge badge-muted" style="text-decoration: line-through;">Arquivado</span>'
                  '<span class="badge badge-brand">Seu time</span><span class="badge"><span class="dot"></span>Aberta</span><span class="badge badge-muted">Encerrada</span>' + uni("pucrs") + uni("merida"))
        alerts = (f'<div class="alert alert-error" style="width: 100%;">{icon("xcircle", 18)}<div><b>Não foi possível enviar a submissão.</b><br><span class="muted">Aguarde antes de submeter de novo.</span></div></div>'
                  f'<div class="alert alert-success" style="width: 100%;">{icon("checkcircle", 18)}<div><b>Veredito · 100/100 pontos</b><br><span class="muted">5/5 casos · Rodada 2 · há 5 s</span></div></div>'
                  f'<div class="alert" style="width: 100%;">{icon("wifi", 18, "var(--muted)")}<div>Conexão perdida — reconectando...</div></div>')
        nav = ('<div class="seg"><span class="on">Rodada</span><span>Geral</span></div><div class="tabs" style="flex: 1;"><span class="on">Visão geral</span><span>Problemas</span><span>Rodadas</span></div>')
        live = (f'<span class="live"><span class="dot"></span>Ao vivo · Rodada 2</span><span class="num" style="font-weight: 600; font-size: 24px;">41:07</span><span class="num" style="font-weight: 600; font-size: 24px; color: var(--brand-text);">04:59</span><span class="muted small">← últimos 5 min em vermelho</span>')
        verdict = (f'<div style="width: 100%; display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; background: var(--card);">'
                   f'<div style="display: flex; align-items: center; gap: 12px; padding: 8px 12px;">{icon("checkcircle", 18, "var(--success)")}<span style="font-weight: 500; width: 56px;">Caso 1</span><span class="mono muted">[1, 2, 3, 4]</span><span class="muted small" style="margin-left: auto;">obtido <span class="mono" style="color: var(--foreground);">6</span></span></div>'
                   f'<div style="display: flex; align-items: center; gap: 12px; padding: 8px 12px; border-top: 1px solid var(--border);">{icon("xcircle", 18, "var(--destructive)")}<span style="font-weight: 500; width: 56px;">Caso 2</span><span class="mono muted">[5, 7, 9]</span><span class="muted small" style="margin-left: auto;">esperado <span class="mono" style="color: var(--foreground);">0</span> · obtido <span class="mono" style="color: var(--destructive);">5</span></span></div>'
                   f'<div style="display: flex; align-items: center; gap: 12px; padding: 8px 12px; border-top: 1px solid var(--border);"><span style="width: 18px; height: 18px; border-radius: 999px; border: 2px solid var(--warning); border-top-color: transparent; display: inline-block;"></span><span style="font-weight: 500; width: 56px;">Caso 3</span><span class="mono muted">[2, 4, 6, 8]</span><span class="muted small" style="margin-left: auto;">executando...</span></div></div>')
        return (f'<div class="{cls}" style="flex: 1; min-width: 0; background: var(--background); color: var(--foreground); border-radius: 12px; border: 1px solid var(--border); padding: 24px; display: flex; flex-direction: column; gap: 22px;">'
                f'<span class="h3">{"Modo escuro" if dark else "Modo claro"}</span>'
                + sec("Botões", btns) + sec("Inputs", inputs) + sec("Badges", badges) + sec("Navegação", nav) + sec("Ao vivo e timer", live) + sec("Alertas", alerts) + sec("Resultados por caso", verdict) + '</div>')
    body = (f'<div class="board">{title_row("Identidade kumite · 04", "Componentes", "Os primitivos shadcn existentes, re-tokenizados: raio 6px, hairlines 1px, sem sombra além do foco. O botão primário é tinta; o vermelho fica para a ação competitiva (Submeter, Abrir rodada), para o estado ao vivo e para o #1. Destrutivo e erro são sempre contorno, nunca preenchimento.")}'
            f'<div style="display: flex; gap: 24px; align-items: stretch;">{col(False)}{col(True)}</div></div>')
    return page("Componentes", body, extra_css=BOARD)

# ---------- Blockly ----------
def blockly_board():
    old = [("Lógica", "hsl(210,45%,55%)"), ("Laços", "hsl(120,45%,55%)"), ("Matemática", "hsl(230,45%,55%)"), ("Texto", "hsl(160,45%,55%)"), ("Listas", "hsl(260,45%,55%)"), ("Variáveis", "hsl(330,45%,55%)"), ("resolver (raiz)", "hsl(230,45%,55%)"), ("entrada", "hsl(330,45%,55%)")]
    new = [("Lógica", BLOCKS["logic"]), ("Laços", BLOCKS["loops"]), ("Matemática", BLOCKS["math"]), ("Texto", BLOCKS["text"]), ("Listas", BLOCKS["lists"]), ("Variáveis", BLOCKS["variables"]), ("resolver (raiz)", BLOCKS["root"]), ("entrada", BLOCKS["input"])]
    def strip(items, label):
        cells = "".join(f'<div style="display: flex; flex-direction: column; gap: 6px;"><div class="swatch" style="height: 56px; background: {c};"></div><span style="font-size: 12px; font-weight: 500;">{n}</span><span class="mono muted" style="font-size: 11px;">{c}</span></div>' for n, c in items)
        return f'<div style="display: flex; flex-direction: column; gap: 10px;"><span class="eyebrow">{label}</span><div style="display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 10px;">{cells}</div></div>'
    rules = ('<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px;">'
             '<div class="card" style="padding: 16px 18px; display: flex; flex-direction: column; gap: 6px;"><span class="h3">Mesma luz, mesma saturação</span><span class="small muted">Todas as categorias em oklch L 0,55 · C 0,13: os matizes continuam distintos (aprendíveis), mas param de brigar entre si e com o vermelho da marca. Variáveis sai do rosa (330°, vizinho do vermelho) para ocre (70°).</span></div>'
             '<div class="card" style="padding: 16px 18px; display: flex; flex-direction: column; gap: 6px;"><span class="h3">Raiz em tinta, entrada em vermelho</span><span class="small muted">O bloco <b>resolver</b> não é arrastável nem apagável — é o tatame. Fica em tinta com texto papel. A <b>entrada</b> é o que o participante recebe: o único bloco vermelho do canvas.</span></div>'
             '<div class="card" style="padding: 16px 18px; display: flex; flex-direction: column; gap: 6px;"><span class="h3">Chrome do editor nos tokens</span><span class="small muted">Toolbox em cartão com barras de categoria, grade de pontos em Papel 2, zoom/lixeira em círculos de 32px, flyout com a mesma borda. Tema escuro: mesmas cores de bloco, grade em Cartão escuro. Tudo em <span class="mono">Blockly.Theme.defineTheme</span> dentro de @kumite/blocks.</span></div></div>')
    body = f'<div class="board">{title_row("Identidade kumite · 05", "Editor Blockly", "Cores de bloco harmonizadas (categorias continuam distintas), bloco-raiz em tinta, bloco de entrada em vermelho, chrome do editor nos tokens da UI.")}{strip(old, "Hoje · matizes padrão do Blockly (HSV)")}{strip(new, "Proposta · @kumite/blocks blockStyles")}{rules}</div>'
    return page("Editor Blockly", body, extra_css=BOARD)
