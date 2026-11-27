// Records the 3D Dadu flyover (flyover/index.html) for the local-voice cut of the video.
// Needs the repo root served on 8765:   python -m http.server 8765 --bind 127.0.0.1   (from the repo root)
// Then from pitch/video:                node scripts/record_flyover.mjs
// Writes public/clips/flyover.webm and public/clips/flyover.json ({ start }: when the flyover begins, in seconds).
import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = new URL('../public/clips/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const size = { width: 1920, height: 1080 };
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1920,1080', '--force-device-scale-factor=1'] });
const ctx = await browser.newContext({ viewport: size, recordVideo: { dir: OUT, size } });
const t0 = Date.now();
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8765/pitch/video/flyover/');
await page.waitForFunction(() => window.ready === true, null, { timeout: 120000 });
await page.waitForTimeout(6000); // let the satellite and terrain tiles finish loading
const start = (Date.now() - t0) / 1000;
await page.evaluate(() => window.play());
await page.waitForTimeout(1500);
const video = page.video();
await ctx.close();
await browser.close();
fs.renameSync(await video.path(), OUT + 'flyover.webm');
fs.writeFileSync(OUT + 'flyover.json', JSON.stringify({ start: Math.round(start * 10) / 10 }));
console.log('saved flyover.webm, flyover starts at', start.toFixed(1), 's');
