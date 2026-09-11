import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
CANVAS = os.path.normpath(os.path.join(HERE, ".."))  # docs/design/canvas
from screens import editor, login, signup_mobile, teams
from screens2 import leaderboard, telao, telao_geral, organizer, home
from identity import logo_board, palette_board, type_board, components_board, blockly_board

OUT = CANVAS

files = {
    "Main.dc.html": editor(False),
    "EditorEscuro.dc.html": editor(True),
    "Login.dc.html": login(),
    "CadastroCelular.dc.html": signup_mobile(),
    "Times.dc.html": teams(),
    "Placar.dc.html": leaderboard(),
    "Telao.dc.html": telao(),
    "TelaoGeral.dc.html": telao_geral(),
    "Organizador.dc.html": organizer(),
    "Inicio.dc.html": home(),
    "Simbolo.dc.html": logo_board(),
    "Paleta.dc.html": palette_board(),
    "Tipografia.dc.html": type_board(),
    "Componentes.dc.html": components_board(),
    "Blockly.dc.html": blockly_board(),
}
for name, html in files.items():
    with open(os.path.join(OUT, name), "w") as f:
        f.write(html)

HEIGHTS = os.path.join(HERE, "heights.json")
H = json.load(open(HEIGHTS)) if os.path.exists(HEIGHTS) else {}
def h(name, default): return int(H.get(name, default) * 1.05 / 10 + 1) * 10
ROW2 = max(h("Simbolo", 760), h("Paleta", 900)) + 120
ROW3 = ROW2 + max(h("Tipografia", 820), h("Blockly", 700)) + 120

canvas = {
  "pages": [{"id": "identidade", "name": "Identidade"}, {"id": "telas", "name": "Telas"}],
  "artboards": [
    {"file": "Simbolo.dc.html", "title": "01 · Símbolo e wordmark", "x": 0, "y": 0, "w": 1200, "h": h("Simbolo", 760), "page": "identidade"},
    {"file": "Paleta.dc.html", "title": "02 · Paleta", "x": 1280, "y": 0, "w": 1200, "h": h("Paleta", 900), "page": "identidade"},
    {"file": "Tipografia.dc.html", "title": "03 · Tipografia", "x": 0, "y": ROW2, "w": 1200, "h": h("Tipografia", 820), "page": "identidade"},
    {"file": "Blockly.dc.html", "title": "05 · Editor Blockly", "x": 1280, "y": ROW2, "w": 1200, "h": h("Blockly", 700), "page": "identidade"},
    {"file": "Componentes.dc.html", "title": "04 · Componentes", "x": 0, "y": ROW3, "w": 1200, "h": h("Componentes", 1100), "page": "identidade"},

    {"file": "Inicio.dc.html", "title": "Início", "x": 0, "y": 0, "w": 1280, "h": 800, "page": "telas"},
    {"file": "Login.dc.html", "title": "Login", "x": 1360, "y": 0, "w": 1280, "h": 800, "page": "telas"},
    {"file": "CadastroCelular.dc.html", "title": "Cadastro · celular", "x": 2720, "y": 0, "w": 390, "h": 844, "page": "telas"},
    {"file": "Main.dc.html", "title": "Editor de problema", "x": 0, "y": 964, "w": 1280, "h": 800, "page": "telas"},
    {"file": "EditorEscuro.dc.html", "title": "Editor · modo escuro", "x": 1360, "y": 964, "w": 1280, "h": 800, "page": "telas"},
    {"file": "Times.dc.html", "title": "Times", "x": 2720, "y": 964, "w": 1280, "h": 800, "page": "telas"},
    {"file": "Placar.dc.html", "title": "Placar", "x": 0, "y": 1884, "w": 1280, "h": 800, "page": "telas"},
    {"file": "Organizador.dc.html", "title": "Painel do organizador", "x": 1360, "y": 1884, "w": 1280, "h": 800, "page": "telas"},
    {"file": "Telao.dc.html", "title": "Placar · modo telão", "x": 2720, "y": 1884, "w": 1440, "h": 810, "page": "telas"},
    {"file": "TelaoGeral.dc.html", "title": "Telão · sem rodada aberta", "x": 0, "y": 2774, "w": 1440, "h": 810, "page": "telas"},
  ],
  "annotations": [
    {"id": "nota-paleta", "x": 1280, "y": -150, "w": 420, "page": "identidade", "text": "Recomendação: variante A (Hinomaru). Todas as telas da página Telas estão nela. Se preferir B ou C, eu re-tokenizo tudo."},
    {"id": "nota-tipo", "x": 0, "y": ROW2 - 130, "w": 380, "page": "identidade", "text": "Corpo: Barlow (recomendado) ou Inter — alterne no controle acima do artboard de tipografia e compare."},
    {"id": "nota-editor", "x": 0, "y": 830, "w": 460, "page": "telas", "text": "Editor: enunciado e resultados colapsáveis (#203), barra de ações ancorada (#160), recentrar junto ao zoom (#205), blocos harmonizados (@kumite/blocks)."},
    {"id": "nota-placar", "x": 0, "y": 1784, "w": 460, "page": "telas", "text": "Placar: colunas A/B/C com legenda (#207), coluna do time fixa, linha do seu time em vermelho-suave. Modo telão = restyle do modo apresentação que já existe."},
    {"id": "nota-mobile", "x": 2720, "y": -150, "w": 390, "page": "telas", "text": "Header mobile: lockup + idioma + menu (#186). Rodapé empilhado. O FAB de reportar bug sai do canto e vira item do menu (#198)."},
  ],
  "launch": {"view": "canvas", "page": "identidade"}
}
with open(os.path.join(OUT, "canvas.json"), "w") as f:
    json.dump(canvas, f, ensure_ascii=False, indent=2)
    f.write("\n")
print("built", len(files), "artboards in", OUT)
