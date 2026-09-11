import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const path = require('node:path');
const fs = require('node:fs');
const here = path.dirname(fileURLToPath(import.meta.url));
// Playwright vem do front/ (já instalado para o e2e), resolvido a partir do package.json dele.
const { chromium } = createRequire(path.resolve(here, '../../../../front/package.json'))('@playwright/test');
const dir = path.resolve(here, '..');                 // docs/design/canvas
const out = path.resolve(here, '../../screens');     // docs/design/screens
const heightsFile = path.join(here, 'heights.json');
fs.mkdirSync(out, { recursive: true });
const sizes = { 'CadastroCelular': [390, 844], 'Telao': [1440, 810], 'TelaoGeral': [1440, 810], 'MenuCelular': [390, 844] };
const flowing = ['Simbolo', 'Paleta', 'Tipografia', 'Componentes', 'Blockly'];
const only = process.argv.slice(2);

// As fontes que todo artboard tem de estar usando de verdade. São servidas de
// generate/fonts/ por @font-face (common.py) — nenhuma requisição externa.
const REQUIRED_FONTS = [
  ['Barlow Condensed', '600 16px "Barlow Condensed"'],
  ['Barlow', '400 16px "Barlow"'],
  ['JetBrains Mono', '400 16px "JetBrains Mono"'],
];

// Antes da #227 aqui havia um waitForTimeout(1500) e as fontes vinham de
// fonts.googleapis.com: offline ou atrás de proxy os 14 PNGs eram gravados em
// Arial Narrow, sem erro nenhum, e viravam a referência visual citada por nome
// em sete issues. Agora a falta de fonte aborta o processo.
//
// Atenção: document.fonts.check() sozinho NÃO serve. Sem nenhuma regra
// @font-face casando, ele responde true — o fallback "está disponível" —, que
// é exatamente o caso que se quer pegar. Por isso aqui se pede o carregamento
// e se exige uma FontFace com status 'loaded'.
async function assertFonts(page, label) {
  const bad = await page.evaluate(async (required) => {
    const problems = [];
    for (const [family, spec] of required) {
      let faces = [];
      try {
        faces = await document.fonts.load(spec);
      } catch (e) {
        problems.push(`${family}: o arquivo não carregou (${e.message})`);
        continue;
      }
      if (faces.length === 0) {
        problems.push(`${family}: nenhuma regra @font-face casou com '${spec}'`);
      } else if (!faces.some((f) => f.status === 'loaded')) {
        problems.push(`${family}: face encontrada mas status='${faces.map((f) => f.status).join(',')}'`);
      }
    }
    await document.fonts.ready;
    return problems;
  }, REQUIRED_FONTS);

  if (bad.length) {
    throw new Error(
      `shot.mjs: as fontes não carregaram em ${label}; nenhum PNG foi escrito.\n` +
        bad.map((b) => `  - ${b}`).join('\n') +
        '\n\nAs fontes são versionadas em docs/design/canvas/generate/fonts/.\n' +
        "Restaure com 'git checkout -- docs/design/canvas/generate/fonts', ou\n" +
        'rebaixe-as seguindo o README de lá. Ver a #227.',
    );
  }
}

const browser = await chromium.launch();
const heights = fs.existsSync(heightsFile) ? JSON.parse(fs.readFileSync(heightsFile, 'utf8')) : {};
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.dc.html'));
const todo = files.filter((f) => !only.length || only.includes(f.replace('.dc.html', '')));

try {
  // Preflight: falhar antes de gravar o primeiro PNG, não no meio da série.
  if (todo.length) {
    const probe = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    await probe.goto('file://' + path.join(dir, todo[0]));
    await assertFonts(probe, todo[0] + ' (preflight)');
    await probe.close();
  }

  for (const f of todo) {
    const stem = f.replace('.dc.html', '');
    const [w, h] = sizes[stem] ?? [flowing.includes(stem) ? 1200 : 1280, 800];
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto('file://' + path.join(dir, f));
    await assertFonts(page, f);
    const full = flowing.includes(stem);
    await page.screenshot({ path: path.join(out, stem + '.png'), fullPage: full });
    if (full) heights[stem] = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.close();
  }
} finally {
  await browser.close();
}
fs.writeFileSync(heightsFile, JSON.stringify(heights, null, 2) + '\n');
console.log('heights', heights);
