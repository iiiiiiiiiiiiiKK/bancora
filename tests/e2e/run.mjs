/**
 * End-to-end browser checks against a production build served by `vite preview`.
 *
 *   npm run test:e2e            # expects http://localhost:4173
 *   BASE_URL=http://… npm run test:e2e
 *
 * Uses the locally installed Chrome through playwright-core; no browser download.
 * Every assertion inspects real results (files, downloads, ZIP contents), not just
 * "the button did something".
 */
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const BASE = process.env.BASE_URL || 'http://localhost:4173';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const downloads = join(root, '.tmp-e2e');
const chrome = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const results = [];
let browser;
let page;

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

async function test(name, fn) {
  try {
    const detail = await fn();
    record(name, true, typeof detail === 'string' ? detail : '');
  } catch (error) {
    record(name, false, error instanceof Error ? error.message : String(error));
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  rmSync(downloads, { recursive: true, force: true });
  mkdirSync(downloads, { recursive: true });

  browser = await chromium.launch({ executablePath: chrome, headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  page = await context.newPage();
  const consoleErrors = [];
  page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(`console: ${message.text()}`);
  });

  await page.goto(BASE, { waitUntil: 'networkidle' });

  await test('home page loads with real data', async () => {
    const title = await page.title();
    assert(title.includes('Bancora'), `unexpected title ${title}`);
    await page.waitForSelector('[data-testid="logo-grid"] article');
    const count = await page.locator('[data-testid="result-count"]').first().textContent();
    assert((count || '').includes('606'), `expected 606 indexed logos, saw ${count}`);
    const cards = await page.locator('[data-testid="logo-grid"] article').count();
    assert(cards === 72, `expected first page of 72 cards, saw ${cards}`);
    return `${cards} cards, ${count?.trim()} total`;
  });

  await test('logo previews actually render from the shipped SVGs', async () => {
    const first = page.locator('[data-testid="logo-grid"] article img').first();
    await first.waitFor({ state: 'visible' });
    const natural = await first.evaluate((img) => ({ w: img.naturalWidth, h: img.naturalHeight, src: img.currentSrc || img.src }));
    assert(natural.w > 0 && natural.h > 0, 'image did not decode');
    assert(natural.src.includes('/logos/'), `unexpected src ${natural.src}`);
    return `${natural.w}×${natural.h}`;
  });

  await test('search filters by name, ignores case and extra spaces, and clears', async () => {
    const input = page.getByTestId('search-input');
    await input.fill('  HSBC  ');
    await page.waitForTimeout(300);
    let count = await page.locator('[data-testid="result-count"]').first().textContent();
    assert(count?.includes('2'), `expected 2 HSBC results (mark + lockup), saw ${count}`);
    const names = await page.locator('[data-testid="logo-grid"] article').count();
    assert(names === 2, `expected 2 cards, saw ${names}`);
    const files = await page.locator('[data-testid="logo-grid"] .card__file').evaluateAll((els) => els.map((el) => el.textContent));
    assert(files.includes('hsbc.svg') && files.includes('hsbc-rect.svg'), `unexpected files ${files}`);
    await page.getByTestId('search-clear').click();
    await page.waitForTimeout(200);
    count = await page.locator('[data-testid="result-count"]').first().textContent();
    assert(count?.includes('606'), `clear did not restore results: ${count}`);
    return 'HSBC → 2, cleared → 606';
  });

  await test('punctuation-tolerant search finds hyphenated file names', async () => {
    await page.getByTestId('search-input').fill('pbc-rect');
    await page.waitForTimeout(250);
    const count = await page.locator('[data-testid="result-count"]').first().textContent();
    assert(count?.includes('1'), `expected 1 result, saw ${count}`);
    await page.getByTestId('search-input').fill('');
    return 'pbc-rect → 1';
  });

  await test('no-results state offers a reset', async () => {
    await page.getByTestId('search-input').fill('zzzz-no-such-bank');
    await page.waitForTimeout(250);
    await page.waitForSelector('[data-testid="empty-state"]');
    const text = await page.getByTestId('empty-state').textContent();
    assert(text?.includes('没有匹配的素材'), 'empty state copy missing');
    await page.getByRole('button', { name: '清除全部筛选' }).click();
    await page.waitForTimeout(250);
    const count = await page.locator('[data-testid="result-count"]').first().textContent();
    assert(count?.includes('606'), `reset failed: ${count}`);
    return 'empty state + reset';
  });

  await test('sorting by file size is actually ordered', async () => {
    await page.selectOption('#logo-sort', 'size-desc');
    await page.waitForTimeout(300);
    const sizes = await page.locator('[data-testid="logo-grid"] article .card__sub').evaluateAll((rows) =>
      rows.map((row) => {
        const text = row.textContent || '';
        const match = /([\d.]+)\s*(KB|MB|B)/.exec(text);
        if (!match) return 0;
        const value = Number(match[1]);
        return match[2] === 'MB' ? value * 1024 * 1024 : match[2] === 'KB' ? value * 1024 : value;
      }),
    );
    const sorted = [...sizes].sort((a, b) => b - a);
    assert(sizes.length > 5, 'not enough rows to verify');
    assert(JSON.stringify(sizes.slice(0, 20)) === JSON.stringify(sorted.slice(0, 20)), 'rows are not sorted largest-first');
    await page.selectOption('#logo-sort', 'name-asc');
    return `${sizes[0]} bytes first`;
  });

  await test('load more appends a page and updates the progress strip', async () => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="logo-grid"] article');
    const before = await page.locator('[data-testid="logo-grid"] article').count();
    const meta = await page.locator('.load-more__meta').textContent();
    assert(meta?.includes('72 / 606'), `unexpected counter: ${meta}`);
    await page.locator('.load-more__btn').click();
    await page.waitForTimeout(600);
    const after = await page.locator('[data-testid="logo-grid"] article').count();
    assert(after === before + 72, `expected 144 cards, saw ${after}`);
    const metaAfter = await page.locator('.load-more__meta').textContent();
    assert(metaAfter?.includes('144 / 606'), `counter did not advance: ${metaAfter}`);
    await page.goto(BASE, { waitUntil: 'networkidle' });
    return `72 → ${after}, counter 144 / 606`;
  });

  await test('about page renders the real asset preview at a usable size', async () => {
    await page.goto(`${BASE}/about`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.asset-preview img');
    await page.waitForTimeout(400);
    const box = await page.evaluate(() => {
      const plate = document.querySelector('.asset-preview');
      const img = plate.querySelector('img');
      const pr = plate.getBoundingClientRect();
      const ir = img.getBoundingClientRect();
      return { plate: [Math.round(pr.width), Math.round(pr.height)], img: [Math.round(ir.width), Math.round(ir.height)], natural: img.naturalWidth };
    });
    assert(box.img[0] > 40 && box.img[1] > 40, `preview is too small: ${JSON.stringify(box)}`);
    assert(box.img[1] <= box.plate[1], 'preview overflows its plate');
    return `${box.img[0]}×${box.img[1]} inside ${box.plate[0]}×${box.plate[1]}`;
  });

  await test('hero secondary buttons are visibly styled', async () => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    const styles = await page.evaluate(() =>
      [...document.querySelectorAll('.hero__actions > *')].map((el) => ({
        text: el.textContent.trim(),
        bg: getComputedStyle(el).backgroundColor,
        transparent: getComputedStyle(el).backgroundColor === 'rgba(0, 0, 0, 0)',
      })),
    );
    const ghost = styles.filter((s) => s.transparent);
    assert(styles.length === 3, `expected 3 hero actions, saw ${styles.length}`);
    assert(ghost.length === 0, `buttons have no background: ${ghost.map((s) => s.text).join(', ')}`);
    return styles.map((s) => `${s.text}: ${s.bg}`).join(' · ');
  });

  await test('hero primary action scrolls to the grid without changing the URL', async () => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    const before = page.url();
    await page.getByRole('button', { name: /浏览素材|Explore logos/ }).click();
    await page.waitForTimeout(800);
    const scrolled = await page.evaluate(() => window.scrollY);
    const gridVisible = await page.evaluate(() => {
      const grid = document.getElementById('explorer');
      return grid ? grid.getBoundingClientRect().top < 400 : false;
    });
    assert(scrolled > 100, `page did not scroll (scrollY=${scrolled})`);
    assert(gridVisible, 'logo grid is not in view after clicking the hero action');
    assert(page.url() === before, `URL changed to ${page.url()}`);
    return `scrollY ${scrolled}`;
  });

  await test('mobile menu navigates home and closes itself', async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const mp = await ctx.newPage();
    await mp.goto(`${BASE}/convert`, { waitUntil: 'networkidle' });
    await mp.waitForTimeout(500);
    await mp.getByRole('button', { name: /打开导航菜单|Open navigation menu/ }).click();
    await mp.waitForTimeout(250);
    await mp.locator('.mobile-nav a').first().click();
    await mp.waitForTimeout(800);
    const menuVisible = await mp.locator('#mobile-navigation').isVisible();
    const path = new URL(mp.url()).pathname;
    assert(menuVisible === false, 'mobile menu stayed open after navigating');
    assert(path.endsWith('/') || path.endsWith('/bancora'), `did not return home: ${path}`);
    await ctx.close();
    return 'closed + home';
  });

  await test('header and footer link to the project repository', async () => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    const headerHref = await page.locator('.header__github').getAttribute('href');
    assert(headerHref === 'https://github.com/iiiiiiiiiiiiiKK/bancora', `header points at ${headerHref}`);
    const footerHrefs = await page.evaluate(() =>
      [...document.querySelectorAll('.footer a[href*="github.com"]')].map((a) => a.getAttribute('href')),
    );
    assert(footerHrefs.includes('https://github.com/iiiiiiiiiiiiiKK/bancora'), `footer links: ${footerHrefs.join(', ')}`);
    return headerHref;
  });

  await test('toolbar controls share one height and baseline', async () => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForSelector('.explorer__tools .segmented');
    await page.waitForTimeout(300);
    const boxes = await page.evaluate(() => {
      const list = [
        document.querySelector('.toolbar-select'),
        document.querySelector('.explorer__tools .segmented'),
        ...document.querySelectorAll('.explorer__tools .chip--button'),
      ].filter(Boolean);
      return list.map((el) => {
        const r = el.getBoundingClientRect();
        return { h: Math.round(r.height), top: Math.round(r.top) };
      });
    });
    const heights = [...new Set(boxes.map((b) => b.h))];
    const tops = [...new Set(boxes.map((b) => b.top))];
    assert(boxes.length >= 4, `expected at least 4 controls, saw ${boxes.length}`);
    assert(heights.length === 1, `control heights differ: ${heights.join(', ')}`);
    assert(tops.length === 1, `controls are not aligned: tops ${tops.join(', ')}`);
    return `${boxes.length} controls · all ${heights[0]}px tall, tops aligned`;
  });

  await test('variant filter narrows the collection', async () => {
    await page.getByRole('button', { name: /^横版组合/ }).first().click();
    await page.waitForTimeout(250);
    const count = await page.locator('[data-testid="result-count"]').first().textContent();
    assert(count?.includes('211'), `expected 211 rectangular assets, saw ${count}`);
    await page.getByRole('button', { name: /^全部版本/ }).click();
    return 'rect → 211';
  });

  await test('details dialog shows real metadata and code snippets', async () => {
    await page.getByTestId('search-input').fill('pbc-rect');
    await page.waitForTimeout(300);
    await page.locator('[data-testid="card-open"]').first().click();
    await page.waitForSelector('[role="dialog"]');
    const title = await page.locator('#bancora-dialog-title').textContent();
    assert(title?.includes('中国人民银行'), `unexpected title ${title}`);
    const body = await page.locator('[role="dialog"]').textContent();
    assert(body?.includes('logos/pbc-rect.svg'), 'relative path missing');
    assert(body?.includes('BLPbcRect'), 'npm export missing');
    const html = await page.locator('#panel-html code').textContent();
    assert(html?.includes('src="/logos/pbc-rect.svg"'), `HTML snippet wrong: ${html}`);
    await page.getByRole('tab', { name: 'React' }).click();
    const react = await page.locator('#panel-react code').textContent();
    assert(react?.includes('export function BLPbcRect'), `React snippet wrong: ${react}`);
    return 'metadata + HTML + React';
  });

  await test('copy asset URL writes the absolute URL to the clipboard', async () => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByRole('button', { name: '复制地址' }).click();
    await page.waitForTimeout(300);
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    assert(clip.startsWith('http'), `clipboard does not contain an absolute URL: ${clip}`);
    assert(clip.endsWith('/logos/pbc-rect.svg'), `unexpected clipboard ${clip}`);
    return clip;
  });

  await test('copy SVG source writes the actual file', async () => {
    await page.getByRole('button', { name: '复制源码' }).click();
    await page.waitForTimeout(600);
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    assert(clip.trimStart().startsWith('<svg'), 'clipboard does not contain SVG source');
    const disk = readFileSync(join(root, 'public/logos/pbc-rect.svg'), 'utf8');
    assert(clip.length === disk.length, `source length mismatch: ${clip.length} vs ${disk.length}`);
    return `${clip.length} chars`;
  });

  await test('single download delivers the original file', async () => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('[role="dialog"]').getByRole('button', { name: /下载 SVG/ }).click(),
    ]);
    const path = join(downloads, 'single.svg');
    await download.saveAs(path);
    const text = readFileSync(path, 'utf8');
    const disk = readFileSync(join(root, 'public/logos/pbc-rect.svg'), 'utf8');
    assert(text === disk, 'downloaded file differs from the shipped file');
    assert(download.suggestedFilename() === 'pbc-rect.svg', `unexpected filename ${download.suggestedFilename()}`);
    return `${text.length} bytes identical`;
  });

  await test('favourite persists across a reload', async () => {
    await page.getByRole('button', { name: '收藏', exact: true }).click();
    await page.waitForTimeout(200);
    const stored = await page.evaluate(() => localStorage.getItem('bancora.favorites.v1'));
    assert(stored?.includes('logos/pbc-rect'), `favourite not stored: ${stored}`);
    await page.keyboard.press('Escape');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const reloaded = await page.evaluate(() => localStorage.getItem('bancora.favorites.v1'));
    assert(reloaded?.includes('logos/pbc-rect'), 'favourite did not survive reload');
    await page.getByTestId('search-input').fill('');
    return 'persisted by id';
  });

  await test('favourites filter shows only the starred asset', async () => {
    await page.getByRole('button', { name: /只看收藏/ }).first().click();
    await page.waitForTimeout(400);
    const count = await page.locator('[data-testid="result-count"]').first().textContent();
    assert(count?.includes('1'), `expected 1 favourite, saw ${count}`);
    await page.getByRole('button', { name: /只看收藏/ }).first().click();
    return '1 favourite';
  });

  await test('selection adds to basket and ZIP export contains real files + manifest', async () => {
    await page.getByTestId('search-input').fill('pbc');
    await page.waitForTimeout(300);
    const selects = page.getByTestId('card-select');
    await selects.nth(0).click();
    await selects.nth(1).click();
    await page.waitForTimeout(200);
    const tray = page.locator('.tray__count');
    const trayText = await tray.textContent();
    assert(trayText?.includes('2'), `expected 2 selected, saw ${trayText}`);
    await page.locator('.tray').getByRole('button', { name: '查看', exact: true }).click();
    await page.waitForSelector('[role="dialog"]');
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /下载 ZIP/ }).click()]);
    const zipPath = join(downloads, 'export.zip');
    await download.saveAs(zipPath);
    const listing = execFileSync('tar', ['-tf', zipPath], { encoding: 'utf8' });
    assert(listing.includes('bancora-export/logos/pbc.svg'), `missing svg in zip: ${listing}`);
    assert(listing.includes('bancora-export/logos/pbc-rect.svg'), 'missing rect svg in zip');
    assert(listing.includes('bancora-export/manifest.json'), 'missing manifest');
    assert(listing.includes('bancora-export/README.txt'), 'missing readme');
    execFileSync('tar', ['-xf', zipPath, '-C', downloads]);
    const manifest = JSON.parse(readFileSync(join(downloads, 'bancora-export/manifest.json'), 'utf8'));
    assert(manifest.count === 2, `manifest count ${manifest.count}`);
    const extracted = readFileSync(join(downloads, 'bancora-export/logos/pbc-rect.svg'), 'utf8');
    const disk = readFileSync(join(root, 'public/logos/pbc-rect.svg'), 'utf8');
    assert(extracted === disk, 'extracted SVG differs from the original');
    const readme = readFileSync(join(downloads, 'bancora-export/README.txt'), 'utf8');
    assert(readme.includes('trademarks'), 'README is missing the trademark notice');
    await page.locator('[role="dialog"]').getByRole('button', { name: '清空', exact: true }).click();
    await page.keyboard.press('Escape');
    return `2 files + manifest (${manifest.count}) + README`;
  });

  await test('converter renders a real PNG at the requested size', async () => {
    await page.goto(`${BASE}/convert`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: '从 Bancora 选择' }).click();
    await page.getByPlaceholder('按名称、文件或 ID 过滤…').fill('pbc-rect');
    await page.waitForTimeout(400);
    await page.locator('.source-item').first().click();
    await page.waitForTimeout(1500);
    const img = page.locator('.preview-stage img');
    await img.waitFor({ state: 'visible' });
    const src = await img.getAttribute('src');
    assert(src?.startsWith('data:image/png'), 'preview is not a PNG data URL');
    await page.locator('#out-width').fill('320');
    await page.locator('#out-height').fill('320');
    await page.waitForTimeout(1200);
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /下载 PNG/ }).click()]);
    const pngPath = join(downloads, 'converted.png');
    await download.saveAs(pngPath);
    const buffer = readFileSync(pngPath);
    assert(buffer.subarray(1, 4).toString() === 'PNG', 'file is not a PNG');
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    assert(width === 320 && height === 320, `unexpected PNG size ${width}×${height}`);
    return `${width}×${height}, ${buffer.length} bytes`;
  });

  await test('converter produces WebP when supported', async () => {
    await page.selectOption('#out-format', 'webp');
    await page.waitForTimeout(1200);
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /下载 WEBP/ }).click()]);
    const webpPath = join(downloads, 'converted.webp');
    await download.saveAs(webpPath);
    const buffer = readFileSync(webpPath);
    assert(buffer.subarray(0, 4).toString() === 'RIFF', 'not a RIFF container');
    assert(buffer.subarray(8, 12).toString() === 'WEBP', 'not a WebP file');
    return `${buffer.length} bytes WebP`;
  });

  await test('converter rejects non-SVG uploads', async () => {
    await page.locator('input[type="file"]').first().setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not an svg'),
    });
    await page.waitForTimeout(400);
    const toast = await page.locator('.toast--error').first().textContent();
    assert(toast?.includes('不是 SVG'), `expected error toast, saw ${toast}`);
    return toast?.slice(0, 60);
  });

  await test('inspector finds real structural problems in an uploaded SVG', async () => {
    await page.goto(`${BASE}/inspector`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /我的上传/ }).click();
    await page.locator('input[type="file"]').first().setInputFiles({
      name: 'unsafe.svg',
      mimeType: 'image/svg+xml',
      buffer: Buffer.from('<svg onload="alert(1)"><script>alert(1)</script><rect width="10" height="10"/></svg>'),
    });
    await page.waitForTimeout(600);
    const body = await page.locator('.table').textContent();
    assert(body?.includes('SCRIPT_TAG'), 'script finding missing');
    assert(body?.includes('EVENT_HANDLER'), 'event handler finding missing');
    return 'SCRIPT_TAG + EVENT_HANDLER detected';
  });

  await test('inspector exports JSON and CSV reports', async () => {
    const [jsonDownload] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'JSON' }).click()]);
    const jsonPath = join(downloads, 'report.json');
    await jsonDownload.saveAs(jsonPath);
    const report = JSON.parse(readFileSync(jsonPath, 'utf8'));
    assert(report.files.length >= 1, 'JSON report has no files');
    assert(report.summary.error >= 1, 'JSON report did not count the error');
    const [csvDownload] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'CSV' }).click()]);
    const csvPath = join(downloads, 'report.csv');
    await csvDownload.saveAs(csvPath);
    const csv = readFileSync(csvPath, 'utf8');
    assert(csv.startsWith('file,name,status,bytes,severity,code,message'), 'CSV header missing');
    assert(csv.includes('SCRIPT_TAG'), 'CSV does not contain the finding');
    return `${report.files.length} row(s)`;
  });

  await test('dark mode applies a full palette and persists', async () => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /切换到深色主题/ }).click();
    await page.waitForTimeout(300);
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    assert(bg === 'rgb(9, 14, 19)', `unexpected dark background ${bg}`);
    const stored = await page.evaluate(() => localStorage.getItem('bancora.theme'));
    assert(stored === '"dark"' || stored === 'dark', `theme not stored: ${stored}`);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    const theme = await page.evaluate(() => document.documentElement.dataset.theme);
    assert(theme === 'dark', 'theme did not survive reload');
    await page.getByRole('button', { name: /切换到浅色主题/ }).click();
    return 'applied + persisted';
  });

  await test('asset index and audit JSON are downloadable and consistent', async () => {
    const index = await page.evaluate(async (base) => {
      const response = await fetch(`${base}/data/assets.json`);
      return response.json();
    }, BASE);
    assert(index.assets.length === 606, `index has ${index.assets.length} assets`);
    const ids = new Set(index.assets.map((asset) => asset.id));
    assert(ids.size === index.assets.length, 'duplicate ids in index');
    const sample = index.assets[0];
    const exists = await page.evaluate(async ({ base, path }) => (await fetch(`${base}${path}`)).ok, { base: BASE, path: sample.publicPath });
    assert(exists, `public path not served: ${sample.publicPath}`);
    const audit = await page.evaluate(async (base) => {
      const response = await fetch(`${base}/data/audit.json`);
      return response.json();
    }, BASE);
    assert(audit.meta.counts.total === 606, 'audit total mismatch');
    return '606 assets, paths served';
  });

  await test('all primary navigation links resolve', async () => {
    for (const path of ['/convert', '/inspector', '/developer', '/about']) {
      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
      const h1 = await page.locator('h1').first().textContent();
      assert(h1 && h1.length > 5, `no h1 on ${path}`);
    }
    await page.goto(`${BASE}/this-page-does-not-exist`, { waitUntil: 'networkidle' });
    const notFound = await page.locator('.empty h3').first().textContent();
    assert(notFound?.includes('页面不存在'), 'no 404 state');
    return '4 pages + 404';
  });

  await test('mobile layout has no horizontal overflow and cards stay usable', async () => {
    const mobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      acceptDownloads: true,
    });
    const mpage = await mobile.newPage();
    await mpage.goto(BASE, { waitUntil: 'networkidle' });
    await mpage.waitForSelector('[data-testid="logo-grid"] article');
    const overflow = await mpage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert(overflow <= 1, `horizontal overflow of ${overflow}px`);
    await mpage.getByRole('button', { name: /打开导航菜单/ }).click();
    await mpage.waitForTimeout(250);
    const menuVisible = await mpage.locator('#mobile-navigation').isVisible();
    assert(menuVisible, 'mobile menu did not open');
    await mpage.getByRole('link', { name: '格式转换' }).first().click();
    await mpage.waitForTimeout(600);
    assert(mpage.url().endsWith('/convert'), `navigation failed: ${mpage.url()}`);
    await mpage.goto(BASE, { waitUntil: 'networkidle' });
    await mpage.locator('[data-testid="card-open"]').first().click();
    await mpage.waitForSelector('[role="dialog"]');
    const dialogOverflow = await mpage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert(dialogOverflow <= 1, `dialog caused ${dialogOverflow}px horizontal overflow`);
    await mpage.screenshot({ path: join(root, 'docs/screenshots/mobile-explorer.png'), fullPage: false });
    await mobile.close();
    return '390×844, menu, detail dialog';
  });

  await test('dialog traps keyboard focus and restores it on close', async () => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.getByTestId('search-input').fill('pbc-rect');
    await page.waitForTimeout(300);
    await page.locator('[data-testid="card-open"]').first().click();
    await page.waitForSelector('[role="dialog"]');
    await page.waitForTimeout(250);
    const initial = await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')));
    assert(initial, 'focus did not move into the dialog');
    let trapped = true;
    for (let i = 0; i < 10; i += 1) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')));
      if (!inside) trapped = false;
    }
    assert(trapped, 'focus escaped the dialog while tabbing');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    assert((await page.locator('[role="dialog"]').count()) === 0, 'Escape did not close the dialog');
    const restored = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
    assert(restored === 'card-open', `focus was not restored to the trigger (got ${restored})`);
    await page.getByTestId('search-input').fill('');
    return 'trapped + Escape + focus restored';
  });

  await test('no runtime errors on the main pages', async () => {
    const relevant = consoleErrors.filter((line) => !/favicon|manifest/i.test(line));
    assert(relevant.length === 0, relevant.slice(0, 4).join(' | '));
    return 'clean console';
  });

  await page.screenshot({ path: join(root, 'docs/screenshots/desktop-explorer.png'), fullPage: false });
  await browser.close();

  const passed = results.filter((r) => r.ok).length;
  writeFileSync(join(root, 'docs/TEST_REPORT.md'), renderReport(passed), 'utf8');
  console.log(`\n${passed}/${results.length} browser checks passed.`);
  if (passed !== results.length) process.exit(1);
}

function renderReport(passed) {
  const rows = results.map((r) => `| ${r.ok ? 'Pass' : '**Fail**'} | ${r.name} | ${r.detail.replace(/\|/g, '\\|')} |`).join('\n');
  return `# Bancora — Browser Test Report

Generated by \`npm run test:e2e\` against ${BASE} at ${new Date().toISOString()}.

**${passed}/${results.length} checks passed.**

| Result | Check | Observed |
| --- | --- | --- |
${rows}

The suite drives a real Chrome build through playwright-core. Downloads are saved to disk and
verified byte-for-byte (or by PNG/WebP magic numbers and dimensions) rather than by toast text alone.
`;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
