/**
 * Renders the Open Graph share card and PNG app icon from real HTML using the
 * locally installed Chrome, so the artwork is reproducible from the repo.
 *
 *   node scripts/generate-brand.mjs
 */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { analyzeInkTone } from '../shared/svg-analysis.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public/brand');
mkdirSync(out, { recursive: true });

const chrome = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const tileNames = ['abchina-rect', 'ccb', 'hsbc', 'boc', 'icbc-rect', 'bankofamerica', 'ubs', 'scotiabank', 'anz'];

const tiles = tileNames.map((name) => {
  const file = join(root, 'public/logos', `${name}.svg`);
  const source = readFileSync(file, 'utf8');
  const ink = analyzeInkTone(source);
  const plate = ink.tone === 'light' ? 'dark' : ink.tone === 'dark' ? 'light' : 'light';
  return {
    name,
    plate,
    src: `file:///${file.replace(/\\/g, '/')}`,
  };
});

const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  body { margin:0; width:1200px; height:630px; font-family: "Segoe UI", Inter, Arial, sans-serif;
         background:#F1F3F5; color:#0B1A26; display:flex; align-items:center; padding:60px 68px; gap:60px;
         position:relative; overflow:hidden; }
  body::before { content:''; position:absolute; inset:0;
    background-image: radial-gradient(circle at 1px 1px, rgba(11,26,38,.10) 1px, transparent 0);
    background-size: 26px 26px; opacity:.6;
    mask-image: linear-gradient(180deg, #000, transparent 72%); }
  .left { position:relative; width:590px; }
  .brand { display:flex; align-items:center; gap:13px; }
  .mark { width:54px; height:54px; border-radius:13px; }
  .name { font-family: "Iowan Old Style", Palatino, Georgia, "Songti SC", serif; font-size:33px; font-weight:600; letter-spacing:-.8px; }
  h1 { font-family: "Iowan Old Style", Palatino, Georgia, "Songti SC", serif; font-size:60px; line-height:1.08; letter-spacing:-2.2px; margin:32px 0 0; font-weight:600; }
  h1 span { color:#0C6B5B; font-style: italic; }
  p { font-size:21px; line-height:1.5; color:#435565; margin:20px 0 0; max-width:500px; }
  .rule { width:54px; height:3px; background:#0C6B5B; border-radius:2px; margin-top:32px; }
  .tag { position:absolute; left:68px; bottom:34px; font-family: ui-monospace, Consolas, monospace; font-size:13px; letter-spacing:.14em; text-transform:uppercase; color:#5B6C7A; }
  .right { position:relative; flex:1; display:grid; grid-template-columns:repeat(3, 1fr); gap:12px;
           padding:16px; background:#FFFFFF; border:1px solid #E2E7EC; border-radius:20px;
           box-shadow:0 30px 60px -34px rgba(11,26,38,.45); }
  .tile { aspect-ratio:1; border-radius:9px; display:grid; place-items:center; padding:15%;
          border:1px solid #E2E7EC; background:#F7F8F9; }
  .tile[data-plate='dark'] { background:#0F1822; border-color:#23303C; }
  .tile img { max-width:100%; max-height:100%; object-fit:contain; }
</style></head><body>
  <div class="left">
    <div class="brand"><img class="mark" src="file:///${join(out, 'bancora-mark.svg').replace(/\\/g, '/')}"><div class="name">Bancora</div></div>
    <h1>Every Bank.<br>Every Logo.<br><span>One Toolkit.</span></h1>
    <p>Bank logos for payments, cards and fintech design systems — search, convert and export.</p>
    <div class="rule"></div>
  </div>
  <div class="right">
    ${tiles
      .map((tile) => `<div class="tile" data-plate="${tile.plate}"><img src="${tile.src}"></div>`)
      .join('\n    ')}
  </div>
  <div class="tag">Open Bank Asset Toolkit</div>
</body></html>`;

const browser = await chromium.launch({ executablePath: chrome, headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.screenshot({ path: join(out, 'og-bancora.png') });
console.log('wrote public/brand/og-bancora.png');

const iconPage = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
await iconPage.setContent(
  `<!doctype html><html><body style="margin:0;width:512px;height:512px;display:grid;place-items:center;background:#F1F3F5">
   <img src="file:///${join(out, 'bancora-mark.svg').replace(/\\/g, '/')}" style="width:512px;height:512px">
   </body></html>`,
  { waitUntil: 'networkidle' },
);
await iconPage.screenshot({ path: join(out, 'icon-512.png'), omitBackground: true });
console.log('wrote public/brand/icon-512.png');

await browser.close();
