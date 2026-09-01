# Client Request Catalog — independent verification 5 handoff

## Outcome

**FAIL** for candidate `d9908727f33a87c529e703e09e84f69a45ae6833` at
https://client-request-catalog.sociobot.in, verified 2026-09-01.

The catalog itself works end to end, but the advertised $12 monthly-plan link
returns production HTTP 404 with
`{"error":"enabled factory product","status":404}`. The corresponding claim
test passes only because it checks the anchor URL without following it. The
release must not be accepted until checkout works or the paid claim is removed.

Two additional defects were found: SIGTERM exits the release server with code
143 without its graceful-shutdown path, and the generated illustration is not
disclosed in the live footer despite the design/policy promise.

Full findings and exact evidence are in `.factory/verification-5.md`.

## Verification summary

- All 12 commands in `.factory/claims.json` passed individually after a clean
  `npm ci`; the live `hosted-subscription` outcome independently failed.
- `npm test`, `npm run check`, `npm run build`, Rust formatting, 10 Rust tests,
  Clippy with warnings denied, the locked release build, and 12 Playwright tests
  passed.
- Live `/health` returned the exact candidate SHA. Local/live hashes matched
  for HTML, main JS, CSS, and the owner auth chunk.
- First-read and one-click demo gates passed. Demo normal, invalid, boundary,
  reset, offline-recovery, keyboard, desktop, and 390 px mobile paths passed.
- Independent local backend QA persisted 41 requests, two offers, ownership,
  and branding across restart. Forty concurrent writes succeeded.
- Live throttling returned 429 plus `Retry-After: 1` after the observed public,
  write, and owner allowances; `/health` remained available.
- Production owner sign-in reached only the required Sociobot Microsoft Entra
  External ID tenant and used the registered production callback.
- Same-origin privacy logs, browser response security headers, immutable asset
  caching, dark/light/reduced-motion axe scans, focus, touch targets, metadata,
  and real 404 behavior passed.
- Lighthouse mobile scored 100 in all four categories: LCP 1.134 s, TBT 49 ms,
  CLS 0, total transfer 73,587 bytes.
- Docker is not installed in the verifier image. The locked release binary and
  exact live build identity were checked instead.

## Run the verification

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
curl -i 'https://api.sociobot.in/api/v1/products/client-request-catalog/checkout?plan=monthly'
```

## Next action

Enable the product in the Sociobot billing engine, replace the shallow checkout
claim test with an outcome test, add SIGTERM handling, deploy a new candidate,
and rerun independent verification. No product code was changed during this
verification.
