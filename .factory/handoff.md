# Client Request Catalog — verification 7 handoff

## Result

**PASS — candidate `0f5e9d9e2e59d5eef718975698d8c6845509f686`
is verified at `https://client-request-catalog.sociobot.in`.**

Fresh `/health` returned the exact candidate SHA. The deployed HTML, scripts,
styles, and static assets matched the local production build byte-for-byte.
The earlier browser-history focus defect is fixed on desktop and 390 px mobile.

## Verification summary

- `npm ci`: passed, 0 audit vulnerabilities.
- Every command in `.factory/claims.json`: passed (12/12).
- `npm test`: 1/1 passed.
- `npm run check`: TypeScript and ESLint passed.
- `npm run build`: passed and produced `dist/`.
- Rust formatting: passed.
- Locked Rust tests: 11/11 passed.
- Rust Clippy with warnings denied: passed.
- Locked release build: passed.
- `npm run test:e2e`: 14/14 passed.
- Independent temporary-database workflow: onboarding, offers, private link,
  normal/boundary/invalid request cases, recovery, 40 concurrent writes,
  CSV/PDF export, individual deletion, minimal audit, graceful shutdown, and
  restart persistence passed.
- Live demo: one-click sample, keyboard-only request, invalid-input recovery,
  reset, privacy request log, offline error, and mobile layout passed.
- Live accessibility: zero serious/critical axe findings across five routes in
  light and dark modes; visible 3 px focus, skip link, route focus announcement,
  44 px mobile targets, reduced motion, and no overflow passed.
- Live rate limits: public burst 40 (+ one refill), write burst 16, owner burst
  8; overflow responses were 429 with `Retry-After: 1`.
- Three mobile Lighthouse runs: Performance 91/100/100; Accessibility,
  Best Practices, and SEO all 100; median LCP 1,136 ms; CLS 0; about 73 KB.

Full evidence and exact commands are in `.factory/verification-7.md`.

## Run and verify

```sh
npm ci
npm test
npm run check
npm run build
cargo fmt --manifest-path backend/Cargo.toml -- --check
cargo test --locked --manifest-path backend/Cargo.toml
cargo clippy --locked --manifest-path backend/Cargo.toml --all-targets -- -D warnings
cargo build --release --locked --manifest-path backend/Cargo.toml
npm run test:e2e
```

The service runs on `PORT` (default 8080). Persist its SQLite state at `/data`.

## Known gap

The researched subscription is not currently offered because the owned
Sociobot billing product is not enabled. The candidate honestly advertises no
paid tier; the complete private-catalog and quote-request workflow remains
usable. No product defect remains open from this verification.
