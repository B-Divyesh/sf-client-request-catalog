# Client Request Catalog — handoff

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

## Verification

Ran successfully:

```sh
npm test
cargo test --manifest-path backend/Cargo.toml
npm run build
npm run test:e2e
```

The Playwright check runs axe and found no serious or critical violations; it
also verified title, language, landmark, single h1, console cleanliness, and
an end-to-end request submission. Direct service checks confirmed request
creation, authenticated CSV export, deletion, `/health`, and 429 responses
after a burst.

Lighthouse (local Chrome, desktop baseline): Performance **100**,
Accessibility **100**, Best Practices **96**, SEO **91**; LCP **1.8 s**, CLS
**0**, TBT **20 ms**. Production asset sizes are 14.1 KB JS, 8.0 KB CSS, and
132 KB hero WebP (all comfortably within the requested budgets).

## Run / deploy

Use `npm install && npm run build && cargo run --manifest-path
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
