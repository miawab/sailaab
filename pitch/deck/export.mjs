// Builds pitch/Sailaab.pdf from the slides, in the order in deck.json, using your installed Chrome.
// Run from pitch/deck:  node export.mjs            (PDF)
//                       node export.mjs houses     (also a PNG preview of one slide)
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const deck = JSON.parse(readFileSync('deck.json', 'utf8'));
const css = readFileSync('deck.css', 'utf8');
const fonts = Object.values(deck.faces).map((f) => `<link rel="stylesheet" href="${f.href}">`).join('\n');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome']
  .find((p) => existsSync(p));
if (!CHROME) throw new Error('Chrome not found');

const page = (ids) => `<!doctype html><html><head><meta charset="utf-8">${fonts}
<style>${css}
@page { size: 1920px 1080px; margin: 0; }
html, body { margin: 0; padding: 0; }
section { width: 1920px; height: 1080px; position: relative; overflow: hidden; break-after: page; }
section aside { display: none; }
.in { animation: none !important; }
</style></head><body>
${ids.map((id) => readFileSync(`slides/${id}.html`, 'utf8')).join('\n')}
</body></html>`;

const run = (args) => execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--virtual-time-budget=8000', ...args], { stdio: 'ignore' });

writeFileSync('_print.html', page(deck.order));
const pdf = resolve('../Sailaab.pdf');
run([`--print-to-pdf=${pdf}`, resolve('_print.html')]);
console.log('wrote', pdf);

const one = process.argv[2];
if (one) {
  writeFileSync('_one.html', page([one]));
  const n = String(deck.order.indexOf(one) + 1).padStart(2, '0');
  const png = resolve(`preview/${n}-${one}.png`);
  run(['--window-size=1920,1080', '--hide-scrollbars', `--screenshot=${png}`, resolve('_one.html')]);
  console.log('wrote', png);
  rmSync('_one.html');
}
rmSync('_print.html');
