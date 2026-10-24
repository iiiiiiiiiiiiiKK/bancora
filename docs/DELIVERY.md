# Bancora — delivery summary

Product: **Bancora**, an *Open Bank Asset Toolkit* built on the MIT-licensed
[icongo/bank-logos](https://github.com/icongo/bank-logos) collection.
Tagline: *Every Bank. Every Logo. One Toolkit.*

This document records what was actually built and measured. Everything below was produced by
running the commands shown, in this checkout, on 2026-10-24.

---

## 1. Upstream audit (Phase 1)

The upstream repository contains no application code: it is a `README.md`, an MIT `LICENSE`, and
two SVG folders. There was therefore no framework to preserve and no npm package to fork; the site
was built fresh with React 18 + TypeScript + Vite, and the existing `@icongo/bl` package was left
untouched.

| Finding | Value |
| --- | --- |
| Upstream framework / build | none — assets only |
| Packaged component library | `@icongo/bl@1.2.0` (inspected via `npm pack`, not modified) |
| SVG files on disk | **606** (422 in `logos/`, 184 in `other/`) |
| Total size | 4.95 MB (median 4.9 KB, largest 64.2 KB) |
| Empty files | 0 |
| Unparsable SVGs | 0 |
| Files without a viewBox | 0 |
| Files with script / event handlers / external refs | 0 |
| Byte-identical duplicate groups | 3 (reported, **not deleted**) |
| Visually identical groups (same path data) | 3 |
| Case-insensitive filename conflicts | 0 |
| README inaccuracies | README claims 612 SVGs; the tree contains 606. Several `title` attributes are wrong (e.g. `sc-rect` and `zaozhuangbank` both say 枣庄银行, `norincogroup` repeats 中国银行业协会). The index uses the documented names it can trust and flags the rest. |

The full report is regenerated into [ASSET_AUDIT.md](ASSET_AUDIT.md).

### Metadata coverage

| Field | Populated | Note |
| --- | --- | --- |
| Name documented upstream | 422 / 606 (69.6%) | From the upstream README |
| Name tentative (from file name) | 184 / 606 (30.4%) | Everything in `other/`; labelled “Tentative” in the UI |
| Official website | 422 / 606 (69.6%) | From the README link |
| viewBox | 606 / 606 (100%) | Parsed from the file |
| npm component name | 422 / 606 (69.6%) | Cross-checked against `@icongo/bl@1.2.0` |
| Country | 0% | Not published upstream; not inferred |
| Category | 0% | Not published upstream; not inferred |
| Trademark permission | 0% | Unknown for every asset |
| SWIFT/BIC | 0% | Never generated |

---

## 2. What was built (Phases 2–4)

| Area | Delivered |
| --- | --- |
| Brand | Original SVG mark, horizontal wordmark, favicon, 1200×630 Open Graph card rendered from real assets, palette documented on `/about` |
| Explorer `/` | 606-asset grid, 72 per page with “load more”, search, collection/variant/favourite/quality filters, five sort orders, compact mode, preview background switch, live result counts, skeleton, empty, error states |
| Search | Local index; case-, whitespace- and punctuation-insensitive; matches name, alias, filename, id and npm export |
| Detail panel | Large preview with light/checker/dark backgrounds, full metadata (id, path, size, viewBox, intrinsic size, website, licence, npm export), download, copy URL, copy source, download source copy, HTML / React / CSS / JSON snippets, favourite and basket actions |
| Batch export | Basket with counts, remove/clear, “select all visible” and “select all filtered”, ZIP built in the browser, progress, cancel, `bancora-export/logos/*.svg` + `manifest.json` + `README.txt` |
| Converter `/convert` | Library picker and local drag-and-drop, PNG/WebP, custom width/height with artwork aspect lock, transparent or solid background, live preview, single download, batch ZIP with `conversion.json`, dimension clamp 8–4096, explicit failure messages |
| Inspector `/inspector` | Full-repository scan (606 files, in-browser), upload scan, pass/warning/error counts, per-file findings, duplicate and filename-conflict reporting, JSON and CSV export |
| Favourites & preferences | localStorage by asset id, survives reload, graceful fallback, dark/light theme persisted, preview background and density persisted |
| Developer `/developer` | Directory structure, field-by-field schema, live HTML/React snippets from a real asset, JSON downloads, URL rules, `@icongo/bl` compatibility notes, local run, contribution steps, conversion behaviour, licence |
| About `/about` | Brand system, collection statistics, data provenance, “tentative” explanation, licence and trademark statement |
| SEO | Title/description/OG/Twitter tags, favicon, manifest, robots.txt, optional sitemap via `BANCORA_SITE_URL` |
| Deployment | Static build, `404.html`, `_redirects`, `vercel.json`, `netlify.toml`, sub-path support through `BANCORA_BASE` |

### Elements deliberately **not** built

- No account system, database, server API or paid third-party service.
- No country or category filters: the metadata does not exist upstream.
- No “API” button that would pretend to call an endpoint that does not exist.
- No npm publication, no remote repository push, no branch-protection changes.

---

## 3. Architecture

```
React 18 + TypeScript + Vite
  src/
    components/   header, footer, cards, dialogs, toasts, copy button, basket
    pages/        Explorer, Convert, Inspector, Developer, About, 404
    hooks/        dataset, favourites, selection, preferences, svg source, inspector, dialog
    lib/          search, paths/snippets, ZIP, conversion, clipboard/storage, toasts
    styles/       design tokens + application layout (light & dark)
    types/        shared data contracts
  shared/svg-analysis.mjs   structural SVG analysis (scripts + browser, no dependencies)
  scripts/                  scan-assets, validate-assets, generate-brand, generate-seo, postbuild
  public/logos, public/other  the real upstream SVGs, unmodified
  public/data/assets.json     generated index (606 records)
```

Data flows one way: files → `scan-assets.mjs` → `public/data/assets.json` → the UI. The UI never
edits metadata, and `validate-assets.mjs` fails the build if the two ever disagree.

---

## 4. Verification

| Command | Result |
| --- | --- |
| `npm install` | 175 packages, no runtime warnings |
| `npm run typecheck` | clean (strict TypeScript, `noUnusedLocals`) |
| `npm run assets:validate` | 10/10 invariants across 606 assets |
| `npm run test` | 9 files, **73 tests passed** |
| `npm run build` | success; `dist/` contains 606 SVGs, index, audit, brand assets, host configs |
| `npm run test:e2e` | **25/25 browser checks passed** in real Chrome |
| Sub-path build | verified at `/bancora/` (index, images, snippets, URLs) |
| Dark mode | verified `rgb(7, 13, 20)`, persisted across reload |
| Mobile 390×844 | no horizontal overflow; menu, cards, dialog all usable |

Full details: [TEST_REPORT.md](TEST_REPORT.md) (generated) and [TESTING.md](TESTING.md).

The browser suite does not merely check that buttons respond — it verifies downloaded files
byte-for-byte against the originals, parses PNG headers for dimensions, checks WebP magic numbers,
extracts exported ZIPs and compares the SVGs inside, and reads back the clipboard.

---

## 5. Known limitations

1. **No production deployment.** The site builds and previews locally; no domain, hosting
   credentials, or repository write access were provided, so nothing was published. A local Git
   repository was initialised on branch `main` with a single commit so the work can be pushed once
   a remote is chosen; no remote was configured and nothing was pushed.
2. **`other/` names are tentative.** 184 files have no upstream description; their display names
   are derived from the Chinese file names and flagged in the UI.
3. **Country/category/SWIFT/trademark data is absent.** This is intentional. Anyone who needs those
   fields must supply a verified source.
4. **WebP depends on the browser's encoder.** Modern Chrome/Edge/Firefox support it; the converter
   reports a clear error rather than mislabelling a fallback.
5. **Font-dependent SVGs.** The inspector warns when a file uses live `<text>`; all current
   repository files are path-based, so this does not affect the shipped collection.
6. **Visual duplicate detection is heuristic.** It compares concatenated `d` attributes; files that
   differ only in fill or structure are reported separately.
7. **Screenshots could not be visually reviewed inside this environment** (the model has no image
   input). Layout was instead verified numerically at 1920/1440/1024/768/430/390/320 px.

---

## 5b. Live deployments

| Host | URL | Notes |
| --- | --- | --- |
| Cloudflare Pages | https://bancora.pages.dev/ | Root-host build, clean paths (/convert, /inspector…), `_redirects` SPA fallback |
| GitHub Pages | https://iiiiiiiiiiiiiKK.github.io/bancora/ | Project build, hash routing (`#/convert`), automated workflow |

The legacy `https://321.market/bancora/` path does **not** exist: 321.market is served by the
`adam-3d-portfolio` Pages project, which owns the custom domain and has no `/bancora` route.
Use `bancora.pages.dev` (clean URLs) or the GitHub Pages project URL (hash URLs).

## 6. Deploying

```bash
npm ci
npm run assets:validate
npm run build
# serve dist/ with SPA fallback
```

- **Cloudflare Pages**: build command `npm run build`, output `dist`. `_redirects` is included.
- **Vercel / Netlify**: `vercel.json` / `netlify.toml` are included.
- **nginx**: `try_files $uri $uri/ /index.html;`
- **Sub-path**: `BANCORA_BASE=/toolkit/ npm run build`.
- **Sitemap**: `BANCORA_SITE_URL=https://example.com npm run seo` before the build.

No remote repository was modified and no npm package was published.

---

## 7. v2 redesign

A second pass replaced the visual system, added the author 𝕏 link, localised the UI to Chinese with an English toggle, made every layout tested at 320–1920 px, and solved “logos disappear in dark mode” with an ink-tone analysis that picks a contrasting preview plate without touching the original files. Details: [REDESIGN.md](REDESIGN.md).

## 8. Suggested next steps

1. Choose and verify the production domain, then publish a preview build and re-run
   `npm run test:e2e` with `BASE_URL` pointed at it.
2. Obtain verified country/category data (with sources) and extend the index only where citations
   exist; the filters are already generic enough to accept it.
3. Add a visual-regression baseline (Playwright screenshots) once the design is frozen.
4. Consider WebP/AVIF derivatives for very large SVGs if the collection grows.
5. If a Bancora npm package is ever wanted, plan it separately and keep `@icongo/bl` untouched.
