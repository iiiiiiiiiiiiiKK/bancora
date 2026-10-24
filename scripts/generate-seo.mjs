/**
 * Generates deployment-specific SEO files.
 *
 *   BANCORA_SITE_URL=https://example.com npm run seo
 *
 * A sitemap needs absolute URLs, and the production domain has not been chosen
 * yet, so the sitemap is only written when BANCORA_SITE_URL is provided. Without
 * it, robots.txt still ships but does not advertise a sitemap that would 404.
 */
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'public');
const raw = (process.env.BANCORA_SITE_URL || '').trim().replace(/\/+$/, '');

const PAGES = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/convert', priority: '0.8', changefreq: 'monthly' },
  { path: '/inspector', priority: '0.7', changefreq: 'monthly' },
  { path: '/developer', priority: '0.9', changefreq: 'monthly' },
  { path: '/about', priority: '0.5', changefreq: 'yearly' },
];

mkdirSync(publicDir, { recursive: true });

if (!raw) {
  writeFileSync(join(publicDir, 'robots.txt'), 'User-agent: *\nAllow: /\n', 'utf8');
  console.log('No BANCORA_SITE_URL set — wrote robots.txt without a sitemap reference.');
} else {
  if (!/^https?:\/\//.test(raw)) {
    console.error(`BANCORA_SITE_URL must start with http(s):// (got "${raw}")`);
    process.exit(1);
  }
  const today = new Date().toISOString().slice(0, 10);
  const urls = PAGES.map(
    (page) =>
      `  <url>\n    <loc>${raw}${page.path}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${page.changefreq}</changefreq>\n    <priority>${page.priority}</priority>\n  </url>`,
  ).join('\n');
  writeFileSync(
    join(publicDir, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    'utf8',
  );
  writeFileSync(join(publicDir, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${raw}/sitemap.xml\n`, 'utf8');
  console.log(`Wrote sitemap.xml for ${raw}`);
}

// Keep index.html's social image absolute when a site URL is known.
const indexPath = join(root, 'index.html');
if (existsSync(indexPath) && raw) {
  console.log('Remember: og:image should resolve to an absolute URL in production.');
}
