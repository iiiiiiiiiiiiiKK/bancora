# Bancora — test summary

This file is the human-readable index. The generated sources are:

- `docs/TEST_REPORT.md` — rewritten by `npm run test:e2e` on every run (38 browser checks).
- `tests/unit/**` — Vitest suites (unit, ZIP format, SVG analysis, data integrity, runtime boundaries).

## Commands and latest results

| Command | Scope | Latest result |
| --- | --- | --- |
| `npm run typecheck` | `tsc -b` over `src/`, `shared/`, `tests/unit` | clean |
| `npm run assets:scan` | regenerate index + audit | 606 assets, 0 null country/category |
| `npm run assets:validate` | data invariants against files | 10/10 checks |
| `npm run test` | Vitest | 16 files, 106 tests passed |
| `npm run build` | `tsc -b && vite build && postbuild` | success, `dist/` with 606 SVGs + host configs |
| `npm run test:e2e` | automatic production build + static server + real Chrome | 38/38 checks |

## What the browser suite verifies (not just "the button clicked")

1. Home renders 606 indexed logos with a 72-card first page.
2. A logo image actually decodes from `/logos/…` (naturalWidth > 0).
3. Search is case-, whitespace- and punctuation-tolerant and clears correctly.
4. The empty state offers a working reset.
5. Size sorting is verified against parsed byte sizes across 20 rows.
6. The variant filter returns exactly 211 rectangular assets.
7. The detail dialog shows real metadata, the npm export name, and real HTML/React snippets.
8. "Copy asset URL" writes an absolute URL to the clipboard.
9. "Copy SVG source" writes a string whose length equals the file on disk.
10. "Download SVG" produces a file byte-identical to `public/logos/pbc-rect.svg`.
11. Favourites persist across a reload, keyed by asset id.
12. The favourites filter reduces the grid to the starred asset.
13. ZIP export: real download, entries extracted with `tar`, manifest parsed, SVG inside compared byte-for-byte with the original, README contains the trademark notice.
14. PNG conversion: 320×320 output verified from the PNG IHDR header.
15. WebP conversion: RIFF/WEBP magic verified.
16. Non-SVG uploads are rejected with an error toast.
17. Inspector detects `SCRIPT_TAG` and `EVENT_HANDLER` in an uploaded hostile SVG.
18. Inspector exports both JSON and CSV, and the JSON counts the error.
19. Dark mode applies `rgb(7, 13, 20)` and survives a reload.
20. `assets.json` / `audit.json` are served, ids are unique, a random public path resolves.
21. All primary routes render an `h1` and an unknown route renders the 404 state.
22. Mobile 390×844: no horizontal overflow, menu opens, navigation works, dialog fits.
23. No runtime console errors on the main pages.
24. The dialog traps Tab focus, closes on Escape, and restores focus to the trigger.
25. A sub-path build (`BANCORA_BASE=/bancora/`) serves a working site from `/bancora/`
    (verified manually; see the deployment section of `docs/DEVELOPMENT.md`).

26. Runtime index validation rejects malformed JSON, duplicate IDs/paths, invalid nested fields and inconsistent aggregate counts before app state is populated.
27. Persisted preferences are field-whitelisted and malformed storage values fall back to defaults.
28. Inspector repository scans use deployment-base URLs, support cancellation, and bound uploads to 200 files / 2 MiB per file / 32 MiB per batch.
29. Converter enforces a 16,777,216-pixel canvas budget and aborts stale preview/batch work; batch ZIP output and cancellation are unit-tested.

## Environment limitations

- The suite uses `playwright-core` with the locally installed Google Chrome
  (`C:\Program Files\Google\Chrome\Application\chrome.exe`). No browser download was needed.
- `npm run test:e2e` builds `dist/`, starts the repository's bounded static server on a free local port, waits for readiness, runs the suite, and tears the server down. Set `CHROME_PATH` to use another Chrome binary; use `test:e2e:raw` only when managing the server yourself.
- Clipboard assertions require the Playwright clipboard permission, granted in the test context.
- The e2e suite targets a local static server. It does not test a deployed domain because no
  deployment target or credentials were provided.
- Lighthouse was not run: it requires a network install not available in this environment.
- `npm run build:pages` validates the GitHub Pages production build; browser checks run against the root-host build.
