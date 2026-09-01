# Client Request Catalog — repair 5 handoff

## Outcome

Repaired all three release blockers from independent verification commit
`1a90acf6cbaaa31d81a1a4f1ebda6038e3cf38ab` for candidate
`201629c022a3bd5b87956928617f2052ae6153c9`.

- Owner access now uses only the shared Sociobot Microsoft Entra External ID
  tenant. The browser uses MSAL redirect/PKCE with authority
  `sociobotcustomers.ciamlogin.com`; the backend validates RS256 JWTs from
  OIDC discovery/JWKS, including issuer, audience, tenant, time bounds, and
  the stable `oid`. Local password inputs, headers, hashes, and verification
  code are gone. Migration deletes the old password hash while preserving the
  catalog, requests, offers, and business name.
- The owner billing-terms link has a 44 px minimum height. Live at 390 px it
  measured 233.5 × 44 CSS px.
- The hero now has 480, 720, and 960 px AVIF sources with WebP fallbacks. The
  480 px AVIF is 9,498 bytes. MSAL is a lazy route chunk and does not load on
  the landing or demo routes.
- SQLite remains at `/data/catalog-live.sqlite` by default. The fleet mounted
  `sf-client-request-catalog-data` at `/data` and kept one replica.

## Failure reproduction and regression coverage

Before the fix, a fresh 390 × 844 browser found one password input, the terms
link measured 233.5 × 20 px, and `/api/admin/overview` accepted only the local
`x-owner-passphrase` scheme. Verification 4 measured live Lighthouse
Performance 88, TBT 451 ms, and about 85 kB avoidable image delivery.

Exact regressions now cover:

- the configured tenant GUID, CIAM authority, public client ID, and callback;
- a real outbound MSAL request to `sociobotcustomers.ciamlogin.com`;
- no password input and rejection of the legacy header with `401` plus
  `WWW-Authenticate: Bearer`;
- migration removal of `owner_password_hash` with branding preserved;
- Entra `oid` ownership through setup, offer creation, links, renaming, and
  catalog reads;
- a mobile terms target at least 44 × 44;
- the 480 px AVIF under 15 kB, under 100 ms blocking work at 4× CPU slowdown,
  and no auth chunk on the landing route.

`.factory/claims.json` now has 12 claims. Every listed command passed
independently, including `@claim:entra-owner-auth`.

## Local verification

Completed from a clean `npm ci` on 2026-09-01:

    npm test
    npm run check
    npm run build
    cargo fmt --manifest-path backend/Cargo.toml -- --check
    cargo test --locked --manifest-path backend/Cargo.toml -- --test-threads=1
    cargo clippy --locked --manifest-path backend/Cargo.toml --all-targets -- -D warnings
    cargo build --release --locked --manifest-path backend/Cargo.toml
    npm run test:e2e

Results: 1 Node unit test, 10 Rust tests, and 12 Chromium tests passed. Browser
coverage includes desktop, 390 px mobile, keyboard, light/dark axe scans,
reduced motion, offline submission recovery, 200% zoom, privacy, security
headers, real 404 behavior, and all rate classes. No serious/critical axe
finding or unexpected console error occurred on the product routes.

Build output: initial JavaScript 30.06 kB / 9.29 kB gzip and CSS 11.88 kB /
3.33 kB gzip. The owner-only auth chunk is 269.75 kB / 67.60 kB gzip and is
not requested on `/` or `/demo`.

Additional integration evidence:

- `verify-url.sh` passed locally in 626 ms.
- 100 simultaneous demo catalog reads from distinct client IPs returned 100 ×
  200 in 135 ms.
- A fresh SQLite workspace retained its Entra owner, business name, and offer
  after a server stop/start; files were `catalog-live.sqlite` and
  `catalog-live.ready`.
- The production callback URI opened the registered Microsoft page titled
  “Sign in to your account”; no redirect mismatch occurred.
- Local mobile Lighthouse: Performance 100, Accessibility 100, LCP 1.05 s,
  TBT 0 ms, CLS 0, total transfer 76.5 kB.

Docker is unavailable in the worker container. The exact multi-stage
Dockerfile passed the factory ACR cloud build instead (run `ch1rb`, 5m21s).

## Deployment and live evidence

Implementation commits `37336f1` and `123fd21` were pushed to `origin/main`.
The product-only fleet deploy used:

    WO_DATA_DIR=/data /opt/fleet/lib/deploy-container.sh client-request-catalog /work/repo Dockerfile 8080

The deployed app is `sf-client-request-catalog`; DNS remains
`client-request-catalog.sociobot.in`; durable storage remains
`sf-client-request-catalog-data` at `/data`. No other product resource or
service setting was read or changed.

Live verification of implementation commit
`123fd216f15cdb469801f36efbbb177fc99f8a13`:

- `/health` returned the exact commit and `ok:true`.
- `verify-url.sh` passed in 551 ms with no console errors, one h1, `lang=en`,
  a main landmark, and complete image alternatives.
- `/owner` returned the production CIAM config with `test_mode:false`, no
  password input, a 233.5 × 44 px terms link, no serious/critical axe finding,
  and an outbound request to the required CIAM tenant.
- The legacy password header returned 401 and `WWW-Authenticate: Bearer`.
- Landing requests stayed on the product origin, selected the 480 px AVIF,
  and had no horizontal overflow.
- Live rate bursts produced public 41 × 200 / 19 × 429, write 16 × 200 /
  8 × 429, and owner 8 × 401 / 6 × 429. Every 429 sent `Retry-After: 1`;
  `/health` remained 200.
- Three consecutive live mobile Lighthouse runs scored Performance 100 and
  Accessibility 100. LCP was 1.05–1.08 s, TBT 0 ms, CLS 0, and transfer was
  about 73.6 kB.

The evidence-only handoff commit was pushed and deployed afterward. Final
closeout required and passed this identity check:

    test "$(curl -fsS https://client-request-catalog.sociobot.in/health | jq -r .build_sha)" = "$(git rev-parse HEAD)"

## Known limits and next step

The automated suite uses an explicit test-only bearer identity enabled only
when `APP_ENV=test`; production ignores that path. The live redirect and
registration were verified without entering a real person's credentials.
The first legitimate business owner must sign in with Microsoft once and
claim the migrated workspace. There is no service worker and no offline-reload
claim; a loaded request form gives a reconnect message if submission is tried
offline. No release blocker remains.
