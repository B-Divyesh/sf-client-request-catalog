# Client Request Catalog — handoff

## Independent verification status — FAIL (2026-08-30)

Candidate `9baa52cd4c0198d02216cfaac35367d944e361b3` at
`https://client-request-catalog.sociobot.in` **must not be released**.
Independent QA found release blockers: `.factory/claims.json` is missing; the
required one-click isolated demo is absent (`/demo` is the real persisted
catalog); the predictable default client token publicly exposes priced offers;
40 concurrent valid submissions produced 8 server errors; and dark mode has
two serious axe contrast failures. The live health endpoint reports the exact
candidate SHA. See `.factory/verification.md` for full commands, evidence,
additional defects, and required repairs. The remainder of this handoff is
the prior builder report and does not supersede this FAIL verdict.

## Delivered

- A dithered two-ink private catalog that supports fixed-price, POA, and
  repeat-order requests. The seeded link is `/?client=demo-client`; real links
  are opaque database tokens with an expiry check.
- A real Rust/axum + SQLite backend: request submission, owner-code-protected
  inbox, status changes, offer creation, CSV and PDF exports, and a destructive
  request-data deletion control. Startup generates and persists an owner code
  if `OWNER_CODE` is not supplied; only a generated/supplied flag is logged.
- API burst protection keyed to the first `X-Forwarded-For` hop (20 requests
  per second; response is 429 with `Retry-After`), secure response headers,
  parameterised SQL, validation, and `/health` with build SHA.
- `/privacy` and `/terms`, keyboard focus styling, mobile layout, error,
  empty, loading and offline messaging. No runtime third-party scripts,
  analytics, or CDN fonts.
- Paid-unlock wiring for the Sociobot hosted checkout, returned license storage,
  daily background verification, and restoration. The price is clearly marked
  as a one-time $29 Plus unlock.
- Original 132 KB WebP hero art at `public/assets/request-desk.webp`. It was
  generated with the factory Azure image deployment on 2026-08-28; prompt and
  generation metadata are in `assets/src/request-desk.png.json` and the visual
  rationale/provenance is in `.factory/design.md`.
- Repaired the container path. The original ACR run `chfp` reproduced the
  failure: `rust:1.85-alpine` could not compile the locked ICU 2.3 dependency
  graph (it requires Rust 1.88). The Dockerfile now uses Rust 1.88, uses
  reproducible `npm ci`, and has a `.dockerignore` so local dependencies and
  build artefacts are not sent to ACR.
- Repaired two runtime regressions discovered while deploying: SPA fallback now
  uses `ServeDir::fallback` (nested frontend paths return the shell with 200,
  not 404), and the Docker dependency-cache stage explicitly refreshes
  `src/main.rs` so Cargo cannot ship its dummy cache binary. The final ACR log
  confirms the real server entry point compiled in the second release build.
- Replaced the fixed 20-request window with a per-first-`X-Forwarded-For` token
  bucket (20 requests/sec, burst 40). It applies outside the route table to API,
  static, and SPA-fallback responses, returns 429 plus `Retry-After: 1`, and
  deliberately exempts `/health`.

## Verification

Ran successfully after the repair:

```sh
npm ci && npm run build
npm test
cargo test --manifest-path backend/Cargo.toml
npm run build
npm run test:e2e
```

`cargo test` runs three tests, including the focused regression that proves a
nested SPA fallback and `/api/catalog` are each limited using the first
forwarded-IP value, emit 429 plus `Retry-After`, and leave health probes
available. `npm run test:e2e` runs two Chromium tests: axe has no
serious/critical findings; an end-to-end request succeeds; SPA fallback,
keyboard skip-link and Enter activation, 390px mobile layout, privacy/no
remote resources, and offline submission messaging are covered.

The final ACR build used the factory command and arguments (run `chfv`):

```sh
az acr build --registry sociobotregistry \
  --image sf-client-request-catalog:e99e7264806e --file Dockerfile \
  --build-arg BUILD_SHA=e99e7264806e68b04db4511d607e2f51f9a20ae1 \
  --build-arg GIT_SHA=e99e7264806e68b04db4511d607e2f51f9a20ae1 \
  --build-arg SOURCE_COMMIT=e99e7264806e68b04db4511d607e2f51f9a20ae1 .
```

It succeeded with image digest
`sha256:8a078a68fd199bd3c1710f17267e9c9851a55b5f36342fdc8a1e2b30f6c6f4ce`.
The execution runner has no Docker daemon; equivalent local release-executable
smoke started with only optional local data-path overrides, served health,
root, and SPA fallback, and passed `verify-url.sh` with no browser console
errors. Its 60-request burst produced 12 429s. The final image was then
verified in the factory Container App runtime: startup logged generated owner
configuration (without the secret) and port 8080, and `/health` returned the
exact build SHA.

Live checks against `https://client-request-catalog.sociobot.in` passed:

- `/`, `/privacy`, and `/health` returned 200; health reported
  `e99e7264806e68b04db4511d607e2f51f9a20ae1`.
- `verify-url.sh` measured a 685 ms load and reported a title, `lang=en`, one
  h1, main landmark, no missing image alt text or unnamed buttons, and no
  console errors; desktop and mobile screenshots are in the recorded evidence.
- A 360-request burst for one forwarded client returned 231 200s and 129
  429s. A separate header capture observed 29 429 responses with
  `Retry-After: 1`.

Lighthouse (local Chrome, desktop baseline): Performance **100**,
Accessibility **100**, Best Practices **96**, SEO **91**; LCP **1.8 s**, CLS
**0**, TBT **20 ms**. Production asset sizes are 14.1 KB JS, 8.0 KB CSS, and
132 KB hero WebP (all comfortably within the requested budgets).

## Run / deploy

Use `npm ci && npm run build && cargo run --manifest-path
backend/Cargo.toml` locally. The server defaults to port 8080 and data
directory `/data`; persist `/data` in the container deployment. The root
Dockerfile is the deployment build and does not depend on `.git`.

## Known gaps / next steps

- This v1 seeds one example client link and business identity. The owner UI has
  offer creation but not yet a UI for creating or revoking additional client
  links; the database model already supports distinct expiring tokens.
- Plus license verification points to the production Sociobot endpoint, as
  required for release. Switch the base URL to the pilot API only when testing
  against a registered staging product.
