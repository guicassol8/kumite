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
const sizes = { 'CadastroCelular': [390, 844], 'Telao': [1440, 810] };
const flowing = ['Simbolo', 'Paleta', 'Tipografia', 'Componentes', 'Blockly'];
const only = process.argv.slice(2);
const browser = await chromium.launch();
const heights = fs.existsSync(heightsFile) ? JSON.parse(fs.readFileSync(heightsFile, 'utf8')) : {};
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.dc.html'))) {
  const stem = f.replace('.dc.html', '');
  if (only.length && !only.includes(stem)) continue;
  const [w, h] = sizes[stem] ?? [flowing.includes(stem) ? 1200 : 1280, 800];
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto('file://' + path.join(dir, f));
  await page.waitForTimeout(1500);
  const full = flowing.includes(stem);
  await page.screenshot({ path: path.join(out, stem + '.png'), fullPage: full });
  if (full) heights[stem] = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.close();
}
await browser.close();
fs.writeFileSync(heightsFile, JSON.stringify(heights, null, 2) + '\n');
console.log('heights', heights);
