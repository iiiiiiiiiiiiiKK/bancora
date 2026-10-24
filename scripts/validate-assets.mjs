/**
 * Validate the generated asset index against the files on disk.
 * Exits non-zero when an invariant is broken, so it can gate a build or deploy.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeSvg } from '../shared/svg-analysis.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const datasetPath = join(root, 'public/data/assets.json');
const failures = [];
const checks = [];

function check(name, fn) {
  try {
    fn();
    checks.push({ name, ok: true });
  } catch (error) {
    checks.push({ name, ok: false, error: error.message });
    failures.push(`${name}: ${error.message}`);
  }
}

if (!existsSync(datasetPath)) {
  console.error('public/data/assets.json is missing. Run `npm run assets:scan`.');
  process.exit(1);
}

const dataset = JSON.parse(readFileSync(datasetPath, 'utf8'));
const assets = dataset.assets;

check('dataset has assets', () => {
  if (!Array.isArray(assets) || assets.length === 0) throw new Error('no assets');
});

check('asset ids are unique', () => {
  const seen = new Set();
  for (const asset of assets) {
    if (seen.has(asset.id)) throw new Error(`duplicate id ${asset.id}`);
    seen.add(asset.id);
  }
});

check('every record maps to a real, non-empty file of the recorded size', () => {
  for (const asset of assets) {
    const abs = join(root, 'public', asset.relativePath);
    if (!existsSync(abs)) throw new Error(`missing file for ${asset.id}`);
    const size = statSync(abs).size;
    if (size !== asset.fileSize) throw new Error(`size mismatch for ${asset.id}: ${size} != ${asset.fileSize}`);
    if (size === 0) throw new Error(`empty file ${asset.id}`);
  }
});

check('every SVG file on disk is indexed', () => {
  const indexed = new Set(assets.map((a) => a.relativePath));
  for (const collection of ['logos', 'other']) {
    const dir = join(root, 'public', collection);
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir)) {
      if (!file.toLowerCase().endsWith('.svg')) continue;
      if (!indexed.has(`${collection}/${file}`)) throw new Error(`unindexed file ${collection}/${file}`);
    }
  }
});

check('public paths are absolute and match relative paths', () => {
  for (const asset of assets) {
    if (asset.publicPath !== `/${asset.relativePath}`) throw new Error(`bad publicPath for ${asset.id}`);
    if (!asset.publicPath.startsWith('/')) throw new Error(`non-absolute publicPath for ${asset.id}`);
  }
});

check('formats are recognised', () => {
  for (const asset of assets) {
    if (asset.format !== 'svg') throw new Error(`unexpected format ${asset.format} on ${asset.id}`);
    if (!asset.filename.toLowerCase().endsWith(`.${asset.format}`)) throw new Error(`extension mismatch on ${asset.id}`);
  }
});

check('unknown metadata is null, never invented', () => {
  for (const asset of assets) {
    for (const field of ['country', 'category']) {
      if (asset[field] !== null) throw new Error(`${field} must stay null on ${asset.id}, got ${asset[field]}`);
    }
    if (asset.license?.trademark !== 'unknown') throw new Error(`unverified trademark flag on ${asset.id}`);
  }
});

check('names are present and flagged', () => {
  for (const asset of assets) {
    if (!asset.name || asset.name.trim() === '') throw new Error(`empty name on ${asset.id}`);
    if (!['documented', 'tentative'].includes(asset.nameStatus)) throw new Error(`bad nameStatus on ${asset.id}`);
  }
});

check('quality status matches a fresh structural analysis', () => {
  for (const asset of assets) {
    const source = readFileSync(join(root, 'public', asset.relativePath), 'utf8');
    const analysis = analyzeSvg(asset.relativePath, source);
    if (analysis.status !== asset.quality.status) {
      throw new Error(`quality drift on ${asset.id}: ${asset.quality.status} vs ${analysis.status}`);
    }
  }
});

check('meta counts agree with the records', () => {
  if (dataset.meta.counts.total !== assets.length) throw new Error('total count mismatch');
  const documented = assets.filter((a) => a.nameStatus === 'documented').length;
  if (dataset.meta.counts.documentedNames !== documented) throw new Error('documented name count mismatch');
  if (dataset.meta.counts.totalBytes !== assets.reduce((a, b) => a + b.fileSize, 0)) throw new Error('byte total mismatch');
});

for (const c of checks) console.log(`${c.ok ? 'ok  ' : 'FAIL'}  ${c.name}${c.ok ? '' : ` — ${c.error}`}`);
console.log(`\n${checks.length - failures.length}/${checks.length} checks passed across ${assets.length} assets.`);
if (failures.length > 0) process.exit(1);
