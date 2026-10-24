/**
 * Writes host configuration into dist/ after a build.
 *
 *  node scripts/postbuild.mjs           # root-host build (Cloudflare/Vercel/Netlify)
 *  node scripts/postbuild.mjs --pages   # GitHub Pages project build (hash routing)
 *
 * GitHub Pages has no rewrite rules, so the Pages build copies index.html to
 * 404.html (deep-link fallback) and skips the host-specific config files that
 * would be meaningless there.
 */
import { copyFileSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const pages = process.argv.includes('--pages');

if (!existsSync(join(dist, 'index.html'))) {
  console.error('dist/index.html not found — run `npm run build` first.');
  process.exit(1);
}

if (pages) {
  // GitHub Pages cannot rewrite paths, so a 404.html copy of the shell is the
  // deep-link fallback there.
  copyFileSync(join(dist, 'index.html'), join(dist, '404.html'));
  writeFileSync(join(dist, '.nojekyll'), '', 'utf8');
  console.log('GitHub Pages build: wrote 404.html and .nojekyll.');
  process.exit(0);
}

// Cloudflare Pages / Netlify / Vercel apply their own SPA fallback. Shipping a
// 404.html would make Cloudflare Pages treat unknown paths as hard 404s and
// ignore _redirects, so it is deliberately not written here.

writeFileSync(join(dist, '_redirects'), '/*  /index.html  200\n', 'utf8');

writeFileSync(
  join(dist, 'vercel.json'),
  JSON.stringify(
    {
      $schema: 'https://openapi.vercel.sh/vercel.json',
      cleanUrls: true,
      rewrites: [{ source: '/((?!app/|logos/|other/|data/|brand/).*)', destination: '/index.html' }],
      headers: [
        {
          source: '/app/(.*)',
          headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
        },
        {
          source: '/(logos|other|data|brand)/(.*)',
          headers: [{ key: 'Cache-Control', value: 'public, max-age=604800' }],
        },
      ],
    },
    null,
    2,
  ) + '\n',
  'utf8',
);

writeFileSync(
  join(dist, 'netlify.toml'),
  `[build]
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/app/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
`,
  'utf8',
);

console.log('Wrote _redirects, vercel.json and netlify.toml into dist/.');
