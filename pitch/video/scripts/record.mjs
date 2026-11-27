// Records real footage of Sailaab for the video. Needs the local site running:
//   node api/_dev-server.js   (from the repo root)   and   cd web && npx vite --port 5173
// Then from pitch/video:  node scripts/record.mjs [clipName]
// Uses your installed Chrome (with the GPU) so the map animates smoothly.
import { chromium } from 'playwright';
import fs from 'node:fs';

const APP = 'http://localhost:5173';
const OUT = new URL('../public/clips/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const size = { width: 1920, height: 1080 };
const HOUSE = [67.63871, 26.68539]; // h_031965 near Johi: Danger from 27 Aug 2022 in demo mode

// A visible cursor (Playwright's video doesn't draw the real one).
const CURSOR = `
  const c = document.createElement('div');
  c.style.cssText = 'position:fixed;z-index:99999;width:24px;height:24px;border-radius:50%;background:rgba(37,64,240,.85);border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);pointer-events:none;transform:translate(-50%,-50%);left:-50px;top:-50px;transition:transform .12s';
  addEventListener('mousemove', e => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
  addEventListener('mousedown', () => c.style.transform = 'translate(-50%,-50%) scale(.7)', true);
  addEventListener('mouseup', () => c.style.transform = 'translate(-50%,-50%)', true);
  addEventListener('DOMContentLoaded', () => document.body.appendChild(c));
  try { localStorage.removeItem('sailaab.home'); } catch {}
`;

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

async function moveClick(page, target) {
  const b = typeof target === 'string' ? await page.locator(target).first().boundingBox() : target;
  const x = b.x + (b.width ?? 0) / 2, y = b.y + (b.height ?? 0) / 2;
  await page.mouse.move(x, y, { steps: 30 });
  await pause(250);
  await page.mouse.down();
  await page.mouse.up();
}
const step = (page, i) => page.evaluate((n) => document.querySelectorAll('.t-dots i')[n].click(), i);
const fly = (page, center, zoom, ms = 3000) => page.evaluate(([c, z, d]) => window.sailaabMap.flyTo({ center: c, zoom: z, duration: d }), [center, zoom, ms]);

async function clip(name, url, fn) {
  const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1920,1080', '--force-device-scale-factor=1'] });
  const ctx = await browser.newContext({ viewport: size, recordVideo: { dir: OUT, size } });
  await ctx.addInitScript(CURSOR);
  const page = await ctx.newPage();
  await page.goto(APP + url);
  await page.waitForFunction(() => window.sailaabMap?.loaded());
  await page.mouse.move(1100, 540);
  await pause(2500);
  await fn(page);
  const video = page.video();
  await ctx.close();
  await browser.close();
  const dest = OUT + name + '.webm';
  fs.renameSync(await video.path(), dest);
  console.log('saved', dest);
}

const CLIPS = {
  // Pakistan, with the "why" card
  why: ['/?demo=1', async (page) => { await pause(7000); }],

  // The normal live app: fly to the Indus near Sukkur, tap "Safe here?"
  live: ['/', async (page) => {
    await pause(1200);
    await fly(page, [68.86, 27.7], 9, 3500);
    await pause(4000);
    await moveClick(page, '.check');
    await pause(7000);
  }],

  // One house near Johi on 25 Aug 2022: Danger, and why
  house: ['/?demo=1', async (page) => {
    await step(page, 2);
    await pause(4500);
    await fly(page, HOUSE, 16.2, 2500);
    await pause(3500);
    await moveClick(page, '.t-action');
    await pause(4500);
    await moveClick(page, '.panel .more');
    await pause(5000);
  }],

  // Dadu replay, plays by itself
  dadu: ['/?demo=1', async (page) => {
    await step(page, 3);
    await pause(14000);
  }],

  // Nowshera replay, then the check against FFC gauges
  nowshera: ['/?demo=1', async (page) => {
    await step(page, 4);
    await pause(9000);
    await moveClick(page, '.t-next');
    await pause(7000);
  }],

  // Blind house test, the voice note, the limits, then back to the live app
  end: ['/?demo=1', async (page) => {
    await step(page, 6);
    await pause(5000);
    await moveClick(page, '.t-next');
    await pause(1500);
    await moveClick(page, '.t-play');
    await pause(4000);
    await moveClick(page, '.t-next');
    await pause(4000);
    await moveClick(page, '.t-action.dark');
    await pause(3500);
  }],
};

const only = process.argv[2];
for (const [name, [url, fn]] of Object.entries(CLIPS)) {
  if (only && only !== name) continue;
  await clip(name, url, fn);
}
