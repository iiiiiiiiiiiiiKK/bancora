# Security notes

Bancora is a static site: there is no server to compromise, no database, and no user accounts.
The remaining attack surface is the SVG content itself and the browser APIs used to process it.

## Threat model

| Asset | Risk | Mitigation |
| --- | --- | --- |
| Repository SVGs | A contributed file could contain `<script>`, `on*=` handlers, `<foreignObject>` or external references. | Every file is analysed by `shared/svg-analysis.mjs` at build time; findings appear in `/inspector`, `docs/ASSET_AUDIT.md` and `public/data/audit.json`. The site renders assets through `<img>`, so even a hostile SVG cannot execute script in the Bancora origin. |
| User-uploaded SVGs (converter, inspector) | Same payloads, plus very large files. | Files are read locally with `File.text()`, never uploaded. The converter strips scripts, event handlers, `foreignObject`, iframes, media elements and non-data external references before rasterising via `<img>`; it rejects anything that is not an SVG. Uploads are capped at 2 MB. |
| Clipboard | Copy actions could leak if they silently grabbed something else. | Copy always writes a string that is shown in the UI (URL, snippet, source). The browser test asserts the clipboard contents for URL and source. |
| Local storage | Favourites and preferences could be corrupted or unavailable. | Every read is wrapped in `try/catch`; invalid JSON falls back to defaults. Favourites are stored by stable asset id, not array index. |
| ZIP export | Path traversal through crafted file names. | Export names are produced from `asset.filename` after stripping `/`, `\`, `:`, `?`, `*`, control characters and leading dots; duplicates get a numeric suffix. Verified by extracting real archives in the test suite. |
| Downloads | A broken asset could produce an empty download. | Downloads fetch the file and assert it starts with `<svg` before triggering the save; the browser test compares the result byte-for-byte with the file on disk. |

## Rendering rules

1. **Never inject SVG markup into the DOM.** All previews use `<img src>`; the detail panel never
   uses `dangerouslySetInnerHTML`.
2. **Never evaluate SVG.** No `eval`, no `Function`, no `innerHTML` with asset content.
3. **Sanitise before rasterising.** `sanitizeSvgForRender()` removes active constructs, then the
   image is decoded by the browser's image pipeline, not the HTML parser.
4. **Bound the work.** Conversion dimensions are clamped to 8–4096 px; batch conversion runs
   sequentially so a large basket cannot exhaust memory.
5. **Fail visibly.** A malformed SVG produces a labelled placeholder in the grid and a specific
   error message in the converter; nothing is silently swallowed.

## Deployment hardening

The build output is plain static files. If you deploy behind a server, the following headers are
recommended:

```
Content-Security-Policy: default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: clipboard-write=(self), camera=(), microphone=(), geolocation=()
```

`style-src 'unsafe-inline'` is required because the UI uses inline style attributes for dynamic
values. There is no inline `<script>`: the early theme bootstrap lives in `public/theme-init.js`.

## What this project does not claim

- The inspector checks **structure**, not bank identity, logo accuracy, or brand permission.
- MIT covers the repository, not the trademarks depicted by the SVGs.
- No SWIFT/BIC, country or category data is generated; inventing plausible values would be worse
  than showing nothing.
