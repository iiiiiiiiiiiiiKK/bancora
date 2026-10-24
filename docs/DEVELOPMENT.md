# Development notes

## Requirements

- Node.js 20+ (developed on Node 24)
- npm 10+
- Google Chrome (only for the optional browser test suite and brand asset generation)

## First run

```bash
npm install
npm run assets:validate
npm run dev
```

`assets:validate` fails loudly if `public/data/assets.json` no longer matches the SVG files.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server on port 5173. |
| `npm run build` | `tsc -b` (type check) then `vite build` → `dist/`. |
| `npm run preview` | Serves `dist/` on port 4173 — this is what the browser tests target. |
| `npm run assets:scan` | Regenerates the index, the audit JSON and `docs/ASSET_AUDIT.md`. |
| `npm run assets:scan -- --check` | Exits 1 if the generated files are stale (CI gate). |
| `npm run assets:validate` | Validates the index against the files and the invariants. |
| `npm run test` | Vitest unit + data-integrity tests. |
| `npm run test:e2e` | Playwright-core suite against `http://localhost:4173`. |
| `npm run brand:assets` | Re-renders `public/brand/og-bancora.png` and `icon-512.png` from real SVGs. |
| `BANCORA_SITE_URL=https://… npm run seo` | Writes `sitemap.xml` and a robots.txt pointing at it. |

## Adding or replacing a logo

1. Drop the SVG into `public/logos/` (primary) or `public/other/` (secondary).
2. Keep the upstream convention: `slug.svg` for the mark, `slug-rect.svg` for the rectangular
   lockup. Badge variants in `other/` use a `logo` suffix upstream.
3. Run `npm run assets:scan && npm run assets:validate && npm run test`.
4. Open `/inspector`, run the inspection, and confirm no new structural errors.
5. In the pull request, state where the file came from and why you believe it is licensed for
   redistribution. Do **not** add country, category or trademark fields you cannot cite.

## Data rules (enforced)

- `id` is `collection/basename` — unique and stable.
- Names come from the upstream README; otherwise from the paired variant; otherwise from the
  file name, marked `tentative`.
- `country`, `category` stay `null`. `license.trademark` stays `"unknown"`.
- No SWIFT/BIC data exists anywhere in the dataset.
- `npm run assets:validate` recomputes the structural analysis and fails on drift.

## SVG security model

- Repository and uploaded SVGs are rendered through `<img>` / `Image`, never injected inline.
- The inspector flags `<script>`, `<foreignObject>`, `on*=` handlers, `javascript:` URLs,
  CSS `@import`, entity declarations and external references.
- The converter strips those constructs before rasterising and refuses non-SVG input.
- Uploaded files are read with `File.text()` and never leave the browser.

## Deployment

Bancora is a static SPA. Build once and serve `dist/`:

```bash
npm run build
```

Any static host works (Cloudflare Pages, Netlify, Vercel, S3, nginx). Two details:

1. **SPA fallback.** Routes such as `/inspector` must serve `index.html`. On Cloudflare Pages
   that is automatic; on nginx add `try_files $uri $uri/ /index.html;`.
2. **Sub-path hosting.** Build with a base path, e.g.
   `BANCORA_BASE=/bancora/ npm run build`. All application URLs derive from
   `import.meta.env.BASE_URL`; nothing is hard-coded to `/`.

Set `BANCORA_SITE_URL` before deploying if you want a sitemap and an absolute robots.txt
reference:

```bash
BANCORA_SITE_URL=https://your-domain.example npm run seo
npm run build
```

## Release checklist

```bash
npm ci
npm run assets:scan
npm run assets:validate
npm run typecheck
npm run test
npm run build
npm run preview &
npm run test:e2e
```

Do not publish an npm package under the Bancora name without an explicit product decision:
`@icongo/bl` is the upstream package and remains untouched by this project.
