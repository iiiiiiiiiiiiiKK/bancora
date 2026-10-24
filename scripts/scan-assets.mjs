/**
 * Bancora asset pipeline.
 *
 *   node scripts/scan-assets.mjs        # scan + validate + write index, audit, JSON
 *   node scripts/scan-assets.mjs --check  # fail (exit 1) when generated files are stale
 *
 * Sources of truth, in order:
 *   1. the SVG files on disk (public/logos, public/other)
 *   2. the upstream README (documented Chinese name + official website)
 *   3. the published @icongo/bl package metadata (npm export names), if present
 *
 * Nothing here invents a bank name, country, SWIFT/BIC code, logo origin or
 * licence. Unknown fields stay null and are reported as unknown.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync, statSync, mkdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeSvg, formatBytes } from '../shared/svg-analysis.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, '..');
const PUBLIC_DIR = join(root, 'public');
const COLLECTIONS = ['logos', 'other'];
const CHECK_ONLY = process.argv.includes('--check');

const NPM_PACKAGE_DIR = resolve(root, '../bancora-src/pkg/package');

/* ------------------------------------------------------------------ helpers */

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

const readUtf8 = (path) => readFileSync(path, 'utf8');

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(dir, entry.name))
    .sort((a, b) => a.localeCompare(b));
}

/** Normalise an SVG for near-duplicate detection: keep only drawing commands. */
function pathSignature(source) {
  const parts = [];
  const re = /\sd\s*=\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(source))) parts.push(m[1].replace(/\s+/g, ''));
  if (parts.length === 0) return null;
  return sha256(parts.join('|')).slice(0, 16);
}

/** Simplified Chinese name from the upstream README, indexed by file name. */
function parseUpstreamReadme() {
  const readmePath = join(root, 'docs/UPSTREAM_README.md');
  const map = new Map();
  if (!existsSync(readmePath)) return map;
  const text = readUtf8(readmePath);
  const re = /<a href="([^"]+)">\s*<img src="\.\/logos\/([^"]+)"[^>]*alt="([^"]*)"/g;
  let m;
  while ((m = re.exec(text))) {
    const [, website, file, alt] = m;
    if (!map.has(file)) map.set(file, { website, alt: alt.trim() });
  }
  return map;
}

/** npm metadata published with @icongo/bl: component name -> svg slug. */
function parseNpmMetadata() {
  const dataPath = join(NPM_PACKAGE_DIR, 'lib/data.json');
  if (!existsSync(dataPath)) return { available: false, bySlug: new Map(), version: null };
  const data = JSON.parse(readUtf8(dataPath));
  const pkg = JSON.parse(readUtf8(join(NPM_PACKAGE_DIR, 'package.json')));
  /** @type {Map<string, string[]>} */
  const bySlug = new Map();
  for (const [key, slug] of Object.entries(data)) {
    const [, rawName] = key.split(',');
    if (!rawName) continue;
    const list = bySlug.get(slug) ?? [];
    list.push(`BL${rawName}`);
    bySlug.set(slug, list);
  }
  for (const list of bySlug.values()) list.sort();
  return { available: true, bySlug, version: pkg.version };
}

/**
 * Filename-derived variant. Upstream uses `-rect` for the rectangular lockup
 * and a `logo` suffix for the badge on a rounded white tile. This is a naming
 * convention, not a claim about brand usage.
 */
function variantOf(fileName) {
  const base = fileName.replace(/\.svg$/i, '');
  if (/-rect$/i.test(base)) return 'rect';
  if (/logo_?$/i.test(base)) return 'badge';
  return 'plain';
}

/** A readable label for files that only exist in `other/` (Chinese filenames). */
function tentativeNameFromFile(fileName) {
  const base = fileName.replace(/\.svg$/i, '');
  let cleaned = base
    .replace(/^!+/, '')
    .replace(/_?logo_?$/i, '')
    .replace(/[-_]+/g, ' ')
    .trim();
  if (/^[\x00-\x7F]+$/.test(cleaned)) {
    cleaned = cleaned.replace(/\s+/g, ' ').replace(/\b([a-z])/g, (c) => c.toUpperCase());
    return cleaned === '' ? base : cleaned;
  }
  return cleaned === '' ? base : cleaned;
}

const NAMING_RULES = [
  { code: 'LEADING_BANG', severity: 'info', test: (f) => f.startsWith('!'), message: 'File name starts with "!" (upstream sorting prefix).' },
  { code: 'NON_ASCII_NAME', severity: 'info', test: (f) => /[^\x00-\x7F]/.test(f), message: 'Non-ASCII file name; needs URL encoding.' },
  { code: 'UPPERCASE_NAME', severity: 'info', test: (f) => /[A-Z]/.test(f.replace(/\.svg$/i, '')), message: 'Mixed-case file name; risks case-sensitive 404s.' },
  { code: 'SPACE_IN_NAME', severity: 'info', test: (f) => /\s/.test(f), message: 'File name contains whitespace.' },
  { code: 'DOUBLE_SUFFIX', severity: 'info', test: (f) => /logo_\.svg$/i.test(f), message: 'Unusual suffix "logo_.svg".' },
  { code: 'PARENTHESES', severity: 'info', test: (f) => /[()（）]/.test(f), message: 'File name contains parentheses.' },
];

/* --------------------------------------------------------------------- scan */

function scan() {
  const readme = parseUpstreamReadme();
  const npm = parseNpmMetadata();

  /** @type {any[]} */
  const assets = [];
  /** @type {any[]} */
  const issues = [];
  const seenIds = new Map();
  const seenNames = new Map();

  for (const collection of COLLECTIONS) {
    const dir = join(PUBLIC_DIR, collection);
    for (const absPath of walk(dir)) {
      const fileName = absPath.split(/[\\/]/).pop();
      if (!/\.svg$/i.test(fileName)) continue;

      const relPath = collection + '/' + fileName;
      const buf = readFileSync(absPath);
      const text = buf.toString('utf8');
      const analysis = analyzeSvg(relPath, text);
      const stats = statSync(absPath);
      const base = fileName.replace(/\.svg$/i, '');
      const id = `${collection}/${base}`;
      const documented = collection === 'logos' ? readme.get(fileName) ?? null : null;

      // Name resolution: prefer documented, then the documented sibling
      // (e.g. `abchina.svg` inherits from `abchina-rect.svg`), then the file name.
      let name = null;
      let nameStatus = 'tentative';
      let nameSource = 'filename';
      let website = null;
      let aliases = [];
      if (documented) {
        name = documented.alt;
        nameStatus = 'documented';
        nameSource = 'upstream-readme';
        website = documented.website;
      } else if (collection === 'logos') {
        const siblingName = base.endsWith('-rect') ? `${base.slice(0, -5)}.svg` : `${base}-rect.svg`;
        const sibling = readme.get(siblingName);
        if (sibling) {
          name = sibling.alt;
          nameStatus = 'documented';
          nameSource = 'upstream-readme (paired variant)';
          website = sibling.website;
        }
      }
      if (!name) {
        name = tentativeNameFromFile(fileName);
        nameStatus = 'tentative';
        nameSource = 'filename';
      }

      // The badge variants share the bank name with their plain counterpart;
      // keep the name discoverable through aliases instead of duplicating it.
      const counter = seenNames.get(name) ?? 0;
      seenNames.set(name, counter + 1);
      if (counter > 0) aliases = [`${name} (${variantOf(fileName)})`];

      const npmComponents = npm.bySlug.get(base) ?? [];
      const namingIssues = NAMING_RULES.filter((rule) => rule.test(fileName)).map((rule) => ({
        code: rule.code,
        severity: rule.severity,
        message: rule.message,
      }));
      if (namingIssues.length > 0) {
        issues.push({ id, name, file: relPath, kind: 'naming', findings: namingIssues });
      }
      if (analysis.status !== 'pass') {
        issues.push({ id, name, file: relPath, kind: 'svg', findings: analysis.findings });
      }
      if (!npm.available) {
        // recorded once via meta.unknowns instead of per asset
      }

      if (seenIds.has(id)) throw new Error(`Duplicate asset id: ${id}`);
      seenIds.set(id, relPath);

      assets.push({
        id,
        name,
        nameStatus,
        nameSource,
        aliases,
        filename: fileName,
        relativePath: relPath,
        publicPath: `/${relPath}`,
        collection,
        variant: variantOf(fileName),
        format: 'svg',
        fileSize: buf.byteLength,
        sha256: sha256(buf),
        pathSignature: pathSignature(text),
        viewBox: analysis.viewBox?.raw ?? null,
        width: analysis.width ?? analysis.viewBox?.width ?? null,
        height: analysis.height ?? analysis.viewBox?.height ?? null,
        country: null,
        category: null,
        website,
        source: {
          upstream: 'https://github.com/icongo/bank-logos',
          collection,
          npmExport: npmComponents[0] ?? null,
          npmExports: npmComponents,
          npmPackage: npm.available ? `@icongo/bl@${npm.version}` : null,
        },
        license: {
          code: 'MIT',
          scope: 'repository code and SVG files as published by icongo/bank-logos',
          trademark: 'unknown',
          note: 'MIT covers the repository; the bank trademarks shown remain the property of their owners.',
        },
        quality: {
          status: analysis.status,
          findings: analysis.findings,
          wellFormed: analysis.wellFormed ?? false,
          externalRefs: analysis.externalRefs ?? [],
          elements: analysis.elements ?? {},
        },
        ink: analysis.ink ?? { tone: 'mixed', luminance: 0.5, minLuminance: 0.5, maxLuminance: 0.5, samples: 0 },
        modifiedAt: stats.mtime.toISOString(),
      });
    }
  }

  // ---- duplicates ------------------------------------------------------
  const bySha = new Map();
  for (const asset of assets) {
    const list = bySha.get(asset.sha256) ?? [];
    list.push(asset.id);
    bySha.set(asset.sha256, list);
  }
  const exactDuplicates = [...bySha.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([hash, ids]) => ({ sha256: hash, ids }));

  const bySignature = new Map();
  for (const asset of assets) {
    if (!asset.pathSignature) continue;
    const list = bySignature.get(asset.pathSignature) ?? [];
    list.push(asset.id);
    bySignature.set(asset.pathSignature, list);
  }
  const visualDuplicates = [...bySignature.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([signature, ids]) => ({ signature, ids }));

  // ---- filename conflicts (case-insensitive collisions) ----------------
  const byNameKey = new Map();
  for (const asset of assets) {
    const key = asset.relativePath.toLowerCase();
    const list = byNameKey.get(key) ?? [];
    list.push(asset.relativePath);
    byNameKey.set(key, list);
  }
  const filenameConflicts = [...byNameKey.values()].filter((list) => list.length > 1);

  return { assets, issues, exactDuplicates, visualDuplicates, filenameConflicts, npm };
}

/* ------------------------------------------------------------------- report */

const sum = (values) => values.reduce((a, b) => a + b, 0);
const pct = (part, whole) => (whole === 0 ? '0%' : `${((part / whole) * 100).toFixed(1)}%`);

function coverage(assets, predicate) {
  return { count: assets.filter(predicate).length, pct: pct(assets.filter(predicate).length, assets.length) };
}

function write(relPath, contents) {
  const abs = join(root, relPath);
  mkdirSync(dirname(abs), { recursive: true });
  let previous = '';
  if (existsSync(abs)) previous = readUtf8(abs);
  // `generatedAt` changes on every run; it must not make the index look stale.
  const normalise = (text) => text.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, '<timestamp>');
  if (normalise(previous) === normalise(contents)) return { path: relPath, changed: false };
  if (CHECK_ONLY) return { path: relPath, changed: true };
  writeFileSync(abs, contents, 'utf8');
  return { path: relPath, changed: true };
}

function main() {
  const { assets, issues, exactDuplicates, visualDuplicates, filenameConflicts, npm } = scan();

  assets.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN') || a.id.localeCompare(b.id));

  const formatCounts = assets.reduce((acc, asset) => {
    acc[asset.format] = (acc[asset.format] ?? 0) + 1;
    return acc;
  }, {});
  const qualityCounts = assets.reduce(
    (acc, asset) => {
      acc[asset.quality.status] += 1;
      return acc;
    },
    { pass: 0, warning: 0, error: 0 },
  );
  const totalBytes = sum(assets.map((a) => a.fileSize));
  const largest = [...assets].sort((a, b) => b.fileSize - a.fileSize).slice(0, 5);

  const meta = {
    schemaVersion: 1,
    name: 'Bancora asset index',
    description: 'Generated by scripts/scan-assets.mjs from the SVG files in public/. Do not edit by hand.',
    generatedAt: new Date().toISOString(),
    generator: 'scripts/scan-assets.mjs',
    upstream: {
      repository: 'https://github.com/icongo/bank-logos',
      license: 'MIT',
      readme: 'docs/UPSTREAM_README.md',
    },
    npm: npm.available
      ? { package: '@icongo/bl', version: npm.version, mapped: assets.filter((a) => a.source.npmExport).length }
      : { package: '@icongo/bl', version: null, mapped: 0, note: 'package not present next to this checkout' },
    counts: {
      total: assets.length,
      byFormat: formatCounts,
      byCollection: assets.reduce((acc, a) => {
        acc[a.collection] = (acc[a.collection] ?? 0) + 1;
        return acc;
      }, {}),
      byVariant: assets.reduce((acc, a) => {
        acc[a.variant] = (acc[a.variant] ?? 0) + 1;
        return acc;
      }, {}),
      documentedNames: assets.filter((a) => a.nameStatus === 'documented').length,
      totalBytes,
    },
    quality: {
      ...qualityCounts,
      exactDuplicateGroups: exactDuplicates.length,
      visualDuplicateGroups: visualDuplicates.length,
      filenameConflicts: filenameConflicts.length,
    },
    unknowns: {
      country: 'not published upstream — left null for every asset',
      category: 'not published upstream — left null for every asset',
      trademarkLicense: 'not published upstream — every asset carries license.trademark = "unknown"',
      swift: 'not applicable — Bancora ships no SWIFT/BIC data',
    },
  };

  const dataset = {
    meta,
    assets: assets.map((asset) => ({
      id: asset.id,
      name: asset.name,
      nameStatus: asset.nameStatus,
      nameSource: asset.nameSource,
      aliases: asset.aliases,
      filename: asset.filename,
      relativePath: asset.relativePath,
      publicPath: asset.publicPath,
      collection: asset.collection,
      variant: asset.variant,
      format: asset.format,
      fileSize: asset.fileSize,
      sha256: asset.sha256,
      viewBox: asset.viewBox,
      width: asset.width,
      height: asset.height,
      country: asset.country,
      category: asset.category,
      website: asset.website,
      source: asset.source,
      license: asset.license,
      ink: asset.ink,
      quality: {
        status: asset.quality.status,
        findingCount: asset.quality.findings.length,
        codes: [...new Set(asset.quality.findings.map((f) => f.code))],
        wellFormed: asset.quality.wellFormed,
        externalRefs: asset.quality.externalRefs,
      },
    })),
    issues,
    duplicates: { exact: exactDuplicates, visual: visualDuplicates },
    filenameConflicts,
  };

  const json = JSON.stringify(dataset, null, 2) + '\n';
  const results = [
    write('public/data/assets.json', json),
    write('public/data/audit.json', JSON.stringify({ meta, issues, duplicates: dataset.duplicates, filenameConflicts }, null, 2) + '\n'),
  ];

  // ---- audit markdown --------------------------------------------------
  const namingIssueCount = issues.filter((i) => i.kind === 'naming').length;
  const svgIssueCount = issues.filter((i) => i.kind === 'svg').length;
  const withWebsite = assets.filter((a) => a.website).length;
  const withViewBox = assets.filter((a) => a.viewBox).length;
  const withNpm = assets.filter((a) => a.source.npmExport).length;

  const md = [];
  md.push('# Bancora — Asset Audit');
  md.push('');
  md.push('> Generated by `npm run assets:scan`. Every number below is computed from the files in this');
  md.push('> checkout; nothing is copied from the upstream README. Re-run the script after changing assets.');
  md.push('');
  md.push('## 1. Sources');
  md.push('');
  md.push('| Item | Value |');
  md.push('| --- | --- |');
  md.push('| Upstream repository | https://github.com/icongo/bank-logos |');
  md.push('| Upstream license | MIT (`LICENSE`, © 2022 IconGo) |');
  md.push(`| npm package inspected | ${npm.available ? `@icongo/bl@${npm.version}` : 'not available in this checkout'} |`);
  md.push(`| Collections scanned | ${COLLECTIONS.map((c) => `\`${c}/\``).join(', ')} |`);
  md.push(`| Scan timestamp | ${meta.generatedAt} |`);
  md.push('');
  md.push('## 2. Inventory');
  md.push('');
  md.push('| Metric | Value |');
  md.push('| --- | --- |');
  md.push(`| Total assets indexed | **${assets.length}** |`);
  md.push(`| SVG assets | ${formatCounts.svg ?? 0} |`);
  md.push(`| Other formats | ${Object.entries(formatCounts).filter(([f]) => f !== 'svg').reduce((a, [, n]) => a + n, 0)} |`);
  md.push(`| \`logos/\` | ${meta.counts.byCollection.logos ?? 0} |`);
  md.push(`| \`other/\` | ${meta.counts.byCollection.other ?? 0} |`);
  md.push(`| Rectangular lockups (\`-rect\`) | ${meta.counts.byVariant.rect ?? 0} |`);
  md.push(`| Badge variants (\`…logo.svg\`) | ${meta.counts.byVariant.badge ?? 0} |`);
  md.push(`| Plain marks | ${meta.counts.byVariant.plain ?? 0} |`);
  md.push(`| Total bytes | ${formatBytes(totalBytes)} |`);
  md.push(`| Median file size | ${formatBytes([...assets].sort((a, b) => a.fileSize - b.fileSize)[Math.floor(assets.length / 2)]?.fileSize ?? 0)} |`);
  md.push('');
  md.push('Largest files (candidates for optimisation):');
  md.push('');
  md.push('| File | Size |');
  md.push('| --- | --- |');
  for (const asset of largest) md.push(`| \`${asset.relativePath}\` | ${formatBytes(asset.fileSize)} |`);
  md.push('');
  md.push('## 3. Metadata coverage');
  md.push('');
  md.push('| Field | Populated | Coverage |');
  md.push('| --- | --- | --- |');
  md.push(`| Name (documented in upstream README) | ${meta.counts.documentedNames} | ${pct(meta.counts.documentedNames, assets.length)} |`);
  md.push(`| Name (tentative, from file name) | ${assets.length - meta.counts.documentedNames} | ${pct(assets.length - meta.counts.documentedNames, assets.length)} |`);
  md.push(`| Official website (from README) | ${withWebsite} | ${pct(withWebsite, assets.length)} |`);
  md.push(`| viewBox parsed | ${withViewBox} | ${pct(withViewBox, assets.length)} |`);
  md.push(`| npm export name | ${withNpm} | ${pct(withNpm, assets.length)} |`);
  md.push('| Country | 0 | 0% — not published upstream, deliberately not inferred |');
  md.push('| Category | 0 | 0% — not published upstream, deliberately not inferred |');
  md.push('| Trademark permission | 0 | 0% — unknown for every asset |');
  md.push('| SWIFT/BIC | 0 | not collected by design |');
  md.push('');
  md.push('## 4. Quality checks');
  md.push('');
  md.push('| Status | Assets |');
  md.push('| --- | --- |');
  md.push(`| Pass (no warning) | ${qualityCounts.pass} |`);
  md.push(`| Warning | ${qualityCounts.warning} |`);
  md.push(`| Error | ${qualityCounts.error} |`);
  md.push(`| Files with naming findings | ${namingIssueCount} |`);
  md.push(`| Files with SVG findings | ${svgIssueCount} |`);
  md.push(`| Exact duplicate groups | ${exactDuplicates.length} |`);
  md.push(`| Visually similar groups (identical path data) | ${visualDuplicates.length} |`);
  md.push(`| Case-insensitive file name conflicts | ${filenameConflicts.length} |`);
  md.push('');

  const findingsByCode = new Map();
  for (const issue of issues) {
    for (const finding of issue.findings) {
      const entry = findingsByCode.get(finding.code) ?? { count: 0, severity: finding.severity, message: finding.message, examples: [] };
      entry.count += 1;
      if (entry.examples.length < 3) entry.examples.push(issue.file);
      findingsByCode.set(finding.code, entry);
    }
  }
  if (findingsByCode.size > 0) {
    md.push('### Finding breakdown');
    md.push('');
    md.push('| Code | Severity | Count | Example files |');
    md.push('| --- | --- | --- | --- |');
    for (const [code, entry] of [...findingsByCode.entries()].sort((a, b) => b[1].count - a[1].count)) {
      md.push(`| \`${code}\` | ${entry.severity} | ${entry.count} | ${entry.examples.map((e) => `\`${e}\``).join(', ')} |`);
    }
    md.push('');
  }

  if (exactDuplicates.length > 0) {
    md.push('### Byte-identical files');
    md.push('');
    md.push('Reported, not deleted — removing an asset changes the public URLs that downstream users may already rely on.');
    md.push('');
    for (const group of exactDuplicates.slice(0, 25)) {
      md.push(`- \`${group.ids.join('`, `')}\``);
    }
    if (exactDuplicates.length > 25) md.push(`- …and ${exactDuplicates.length - 25} more groups (see \`public/data/audit.json\`).`);
    md.push('');
  }

  if (visualDuplicates.length > 0) {
    md.push('### Visually identical files (same path data, different bytes)');
    md.push('');
    md.push('Usually the same mark exported with different attributes or whitespace. Verify before merging.');
    md.push('');
    for (const group of visualDuplicates.slice(0, 25)) md.push(`- \`${group.ids.join('`, `')}\``);
    if (visualDuplicates.length > 25) md.push(`- …and ${visualDuplicates.length - 25} more groups.`);
    md.push('');
  }

  if (filenameConflicts.length > 0) {
    md.push('### File name conflicts');
    md.push('');
    for (const group of filenameConflicts) md.push(`- ${group.map((g) => `\`${g}\``).join(' vs ')}`);
    md.push('');
  }

  md.push('## 5. Unknown information');
  md.push('');
  md.push(`- **Country**: unknown for ${assets.length} of ${assets.length} assets (100%). The upstream repository does not publish it and Bancora does not guess from the artwork.`);
  md.push(`- **Category**: unknown for ${assets.length} of ${assets.length} assets (100%).`);
  md.push(`- **Trademark permission**: unknown for all assets. MIT applies to the repository, not to the banks' marks.`);
  md.push('- **SWIFT/BIC**: not part of the dataset. Generating codes from names would produce plausible-looking false data.');
  md.push(`- **Names**: ${assets.length - meta.counts.documentedNames} assets fall back to a file-name-derived tentative name. These are labelled "Tentative" in the UI and must not be treated as confirmed institution names.`);
  md.push('');
  md.push('## 6. How the index is generated');
  md.push('');
  md.push('```bash');
  md.push('npm run assets:scan      # regenerate public/data/*.json + this report');
  md.push('npm run assets:validate  # fail when the index is stale or violates a data invariant');
  md.push('```');
  md.push('');
  md.push('The script performs, in order: directory walk → UTF-8 parse → structural SVG analysis');
  md.push('(well-formedness, viewBox, dimensions, script/event/external references) → sha256 + path-data');
  md.push('signature → name resolution (README, then paired variant, then file name) → duplicate and');
  md.push('conflict detection → JSON + Markdown output. It is deterministic: the same assets always');
  md.push('produce the same index (apart from the recorded timestamp).');
  md.push('');

  results.push(write('docs/ASSET_AUDIT.md', md.join('\n')));

  const changed = results.filter((r) => r.changed);
  for (const r of results) console.log(`${r.changed ? (CHECK_ONLY ? 'STALE' : 'wrote') : 'unchanged'}  ${r.path}`);
  console.log(
    `\n${assets.length} assets · ${qualityCounts.pass} pass / ${qualityCounts.warning} warning / ${qualityCounts.error} error · ` +
      `${exactDuplicates.length} exact dupes · ${visualDuplicates.length} visual dupes`,
  );

  if (CHECK_ONLY && changed.length > 0) {
    console.error('\nIndex is stale. Run `npm run assets:scan`.');
    process.exitCode = 1;
  }
}

main();
