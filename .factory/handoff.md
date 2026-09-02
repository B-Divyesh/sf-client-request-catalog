# Handoff — Client Request Catalog polish round 2

## Outcome

All 33 cumulative findings from review rounds 1 and 2 are resolved. The product keeps its dithered trade-print identity and now has parseable demo PDFs, fully proved claims, exact copy, live route metadata, complete request disclosures, and crawl-safe export controls.

The repaired code commit is `d963ccd78dbf4abae0922bf8a769218ba3fb4d1d`. ACR build `ch1w0` succeeded, and the container was deployed with the product-owned `sf-client-request-catalog-data` share mounted at `/data` with one replica.

## What changed

- Built real browser-side PDFs and parsed both sample and server exports in tests.
- Proved request persistence by reading the authenticated inbox and SQLite row, including phone, reference, note, quantity, and offer.
- Changed protected export links to buttons with authenticated fetch or sample Blob downloads.
- Strengthened the no-checkout test to cover fixed and quote-needed offers, state, controls, and network traffic.
- Rewrote unsupported reply and vague “clear request” wording across landing, README, Privacy, Terms, metadata, and catalog copy.
- Added `/owner` to the sitemap.
- Added a generated copy audit that fails the browser gate when landing, metadata, README, or catalog copy changes.
- Preserved the one-click `/?demo=1` sandbox, persistent banner, Reset demo, and Set up your catalog actions.

Every finding-to-evidence mapping is in `.factory/polish-2.md`.

## Verification

Exact claim verification from clean clone `/tmp/crc-polish2-clean.T5g6Fd/repo`:

- 20 of 20 `.factory/claims.json` commands passed independently.
- `npm test`: 3 passed.
- `npm run check`: TypeScript and ESLint passed.
- `npm run build`: passed; initial app JavaScript 42.07 KB raw / 12.96 KB gzip, CSS 12.44 KB raw / 3.46 KB gzip. The 67.60 KB gzip auth chunk remains lazy.
- `cargo fmt --check`: passed.
- `cargo test --locked`: 11 passed.
- `cargo clippy --locked --all-targets -- -D warnings`: passed.
- `npm run test:runtime`: passed, including startup with `PORT` absent and SQLite restart persistence.
- `npm run test:e2e`: 22 passed, including accessibility, mobile, keyboard, privacy, offline behavior, route focus, crawler, metadata, 404, rate limits, and PDF parsing.

Local URL verification passed for home, demo, Privacy, and Terms with one H1, one main landmark, alt text, and zero console errors. Playwright Axe reported zero serious or critical findings.

Docker was unavailable inside the worker. ACR build `ch1w0` successfully built the same multi-stage Dockerfile and served as the container-build gate.

Live verification at `https://client-request-catalog.sociobot.in`:

- `/health` reported the repaired build and `ok: true`.
- Home, `/demo`, `/owner`, `/privacy`, and `/terms` returned 200; the designed missing route returned 404.
- Every route had its own title, canonical, and Open Graph URL.
- The cold sample used only same-origin GET requests and left localStorage, sessionStorage, and IndexedDB empty.
- Sample reset restored 3 offers, 2 client links, and 3 requests.
- The sample PDF parsed as one page and contained the expected reference, client, and offer.
- Every visible internal link returned 200; no protected API export remained as an anchor.
- The 390 × 844 first screen had no horizontal overflow and kept all three facts above the fold.
- Browser Back restored H1 focus and the route announcement.
- Live Lighthouse scored 100 performance, 100 accessibility, 100 best practices, and 100 SEO. LCP was 1.4 s, CLS 0, and TBT 0 ms.

Evidence is under `.factory/evidence/polish-2-live-*` and `.factory/evidence/polish-2-live.json`.

## Run and verify

    npm ci
    npm test
    npm run check
    npm run audit:copy
    cargo fmt --manifest-path backend/Cargo.toml -- --check
    cargo test --locked --manifest-path backend/Cargo.toml
    cargo clippy --locked --manifest-path backend/Cargo.toml --all-targets -- -D warnings
    npm run test:runtime
    npm run test:e2e

Run `npm run audit:copy:update` only after intentionally changing public copy.

## Known gaps

None.
