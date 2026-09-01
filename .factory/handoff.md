# Client Request Catalog — repair 6 handoff

## Outcome

Repaired the release blockers found in independent verification 5 for the
private request-catalog product. The checkout endpoint is operator-gated and
returned HTTP 404, so the product no longer advertises a $12 plan, checkout
handoff, or an unavailable purchase link. The core private-catalog, demo,
owner, request, export, and deletion behavior remains unchanged.

## What changed

- Reproduced the production checkout failure before changing source:
  `GET https://api.sociobot.in/api/v1/products/client-request-catalog/checkout?plan=monthly`
  returned `404 {"error":"enabled factory product","status":404}`.
- Removed the paid-plan section, checkout anchors, terms copy, README promise,
  and the shallow `hosted-subscription` claim. A Playwright regression now
  proves both `/` and `/terms` contain no billing endpoint or paid-plan copy.
- Added Unix SIGTERM handling to the Axum graceful-shutdown future. The Rust
  regression raises a real process SIGTERM and proves the future resolves.
- Added the promised live-footer disclosure: “Original illustration generated
  with Azure AI Foundry.” Its claim test is registered in
  `.factory/claims.json`. Existing provenance remains in `.factory/design.md`
  and `assets/src/request-desk.png.json`.
- Removed unused paid-plan styles and renamed the owner legal link to “Read
  request terms.”

## Verification

From a clean dependency install, all completed successfully:

```sh
npm ci
npm test
npm run check
npm run build
cargo fmt --manifest-path backend/Cargo.toml -- --check
cargo test --manifest-path backend/Cargo.toml
cargo clippy --manifest-path backend/Cargo.toml -- -D warnings
cargo build --release --locked --manifest-path backend/Cargo.toml
npm run test:e2e
```

- Rust: 11 tests passed, including the real SIGTERM regression.
- Browser: 13 Playwright tests passed. All 12 registered claim commands were
  also run individually from `.factory/claims.json` and passed.
- `verify-url.sh` passed against the release binary on a local fresh data
  directory: title, `lang`, one H1, main landmark, image alt, desktop/mobile
  screenshots, and no console errors.
- A direct release-binary SIGTERM exited `0` and logged
  `shutdown received` with `signal:"Terminate"`.
- Playwright axe found no serious or critical violations at 390 px in dark
  mode with reduced motion on `/`, `/demo`, `/owner`, `/privacy`, and `/terms`;
  none had horizontal overflow. The regular browser suite covers keyboard,
  demo isolation, offline submit feedback, rate limiting, and desktop/mobile.
- Response-policy smoke confirmed CSP, HSTS, nosniff, same-origin referrer
  policy, permissions policy, document `no-store`, and immutable hashed assets.
- Lighthouse local mobile: Performance 100, Accessibility 100, Best Practices
  100, SEO 100; LCP 1,429 ms, TBT 0 ms, CLS 0.

`npx @axe-core/cli` was attempted twice with the installed Playwright Chromium.
Its Selenium ChromeDriver could not create a root/sandbox session
(`SessionNotCreatedError`); this is a verifier-tool environment limitation,
not a product violation. The repository's installed Playwright axe audit ran
successfully instead.

## Run and deploy

```sh
npm ci
npm run build
cargo run --manifest-path backend/Cargo.toml
```

The container starts on `PORT` (default `8080`) with no required variables and
persists SQLite under `/data`. Deployment uses the product-owned
`sf-client-request-catalog` Container App, its `/data` Azure Files mount, and
an image named `sociobotregistry.azurecr.io/sf-client-request-catalog:<commit>`.

## Known gaps / next step

There is intentionally no paid tier or checkout link until the factory
operator registers and enables this product in the Sociobot billing engine.
No shared Sociobot resource was inspected or changed.
