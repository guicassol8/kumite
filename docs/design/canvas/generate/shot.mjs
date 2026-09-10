import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/home/guicassol/Projetos/semana-academica/node_modules/.pnpm/playwright@1.62.1/node_modules/playwright');
const path = require('node:path');
const fs = require('node:fs');
const dir = path.resolve('kumite-identidade');
const out = path.resolve('shots'); fs.mkdirSync(out, { recursive: true });
const sizes = { 'CadastroCelular': [390, 844], 'Telao': [1440, 810] };
const flowing = ['Simbolo', 'Paleta', 'Tipografia', 'Componentes', 'Blockly'];
const only = process.argv.slice(2);
const browser = await chromium.launch();
const heights = fs.existsSync('heights.json') ? JSON.parse(fs.readFileSync('heights.json', 'utf8')) : {};
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
fs.writeFileSync('heights.json', JSON.stringify(heights, null, 2));
console.log('heights', heights);
