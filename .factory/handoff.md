# Client Request Catalog — repair handoff

## Outcome

All release blockers in independent verification commit
`215285516ef02da4b4d3407c4ba8d4f7bf5ab904` are repaired.

- `/` is now a product landing page. It does not fetch a catalog or reveal
  prices. The compromised `demo-client` credential is rejected unconditionally.
- `/demo` uses fixed sample responses from `/api/demo/*`. It never reads or
  writes SQLite. The persistent banner includes Reset demo and Start for real.
- The owner workspace creates 40-character random client links, sets a 1–365
  day expiry, copies links, and revokes them without deleting past requests.
- SQLite uses one pooled connection and a 10-second busy timeout, matching the
  single-writer constraint of its Azure Files mount. The `unix-dotfile` VFS
  uses an atomic lock directory because the mount does not support SQLite's
  default byte-range locks.
  Request references come from the inserted row id, removing the `MAX(id) + 1`
  race. A pre-existing database starts without schema writes while Azure
  overlaps revisions. The public legacy token is rejected in routing.
- The repaired release writes active state to `/data/catalog-live.sqlite`.
  A `catalog-live.ready` marker is written only after initialization completes,
  so a failed first boot cannot turn a partial database into accepted state.
  Inspection of the target container showed that the rejected rollout files
  were zero bytes with 512-byte journals. They remain untouched.
- Dark-mode primary-action text now uses a dedicated contrast token. Navigation,
  footer links, and demo controls meet the 44px target requirement.
- Internal route changes focus the destination h1. Errors use live regions,
  the skip link targets a focusable main landmark, and reduced motion remains
  supported.
- Route titles, descriptions, canonical and social metadata, favicon, touch
  icon, social image, robots, sitemap, real 404 responses, CSP, HSTS, cache
  policy, and permissions policy are present.
- The unimplemented $29 Plus promise and license code were removed. This build
  has no paid tier and makes no monetization claim.

The generated two-ink illustration remains the original product art. Its
source, prompt, and provenance remain in `assets/src/` and `.factory/design.md`.

## Regression coverage

`.factory/claims.json` declares six claims. Every listed command passes from
the isolated `/demo` entry point or the same fresh temporary server:

```sh
npm run test:e2e -- --grep @claim:demo-isolated
npm run test:e2e -- --grep @claim:private-prices
npm run test:e2e -- --grep @claim:request-inbox
npm run test:e2e -- --grep @claim:owner-exports
npm run test:e2e -- --grep @claim:no-trackers
npm run test:e2e -- --grep @claim:no-checkout
```

Backend regressions include a 40-request concurrent write test. It asserts 40
successful responses, 40 unique references, and 40 stored rows. A second test
recreates the legacy public token, runs startup migration, and proves the token
is revoked without duplicating offers. An additional live local exercise sent
40 simultaneous valid requests from distinct forwarded IPs and returned
`{ '200': 40 }`.

## Local verification

The following passed on 2026-08-30:

```sh
npm ci --ignore-scripts
npm test
npm run check
npm run build
cargo fmt --manifest-path backend/Cargo.toml -- --check
cargo test --manifest-path backend/Cargo.toml
npm run test:e2e
```

- Unit tests: 1 Node test and 6 Rust tests passed.
- Browser suite: 11 Chromium tests passed. Coverage includes all claims,
  desktop, 390px mobile, keyboard-only use, route focus, light and dark axe,
  reduced-motion CSS, privacy requests, an isolated offline context, metadata,
  404, cache/security headers, and 429 plus Retry-After.
- Build output: 21.07 KB JavaScript (7.10 KB gzip), 10.22 KB CSS (2.97 KB
  gzip), 164 KB social image, and 132 KB product illustration.
- `verify-url.sh` against the release server reported a 583 ms load, one h1,
  `lang=en`, a main landmark, complete image alt text, named buttons, and no
  console errors. Evidence is under `/tmp/crc-final-evidence` in the worker.
- Mobile Lighthouse: Performance 100, Accessibility 100, Best Practices 100,
  SEO 100; LCP 1.805 s, CLS 0, TBT 0 ms.
- Local `/health` returned `{"build_sha":"local-repair","ok":true}`. An
  unknown route returned the app shell with HTTP 404.

The worker has no Docker or Podman executable. The factory ACR build was used
as the exact container build check.

## Run and operate

```sh
npm ci
npm run build
cargo run --manifest-path backend/Cargo.toml
```

The server listens on `PORT` (default 8080), writes SQLite and its generated
owner code under `/data`, and needs no required environment variable. Active
state is in `/data/catalog-live.sqlite`. Read the owner code from
`/data/owner-code.txt`, open `/owner`, and create a private client link. Use
`/demo` for the non-persistent sample.

The root Dockerfile is multi-stage, uses `rust:1-slim` with its matching Debian
trixie runtime, runs as a non-root user, accepts `BUILD_SHA`, and does not
inspect `.git`.

## Deployment evidence

The official container deployment ran from the final committed HEAD with
`WO_DATA_DIR=/data`, Dockerfile `Dockerfile`, and port 8080. ACR completed the
multi-stage build, and the existing durable `sf-client-request-catalog-data`
mount remained on `/data` with one replica. No other product service was read
or changed.

After deployment, `https://client-request-catalog.sociobot.in/health` returned
200 and the full final source commit passed as `BUILD_SHA`. Root, `/demo`,
`/privacy`, `/terms`, `/robots.txt`, and `/sitemap.xml` returned 200. A missing
route returned 404. The live `verify-url.sh` check reported one h1, `lang=en`,
a main landmark, complete alt text, named buttons, no console errors, and a
552 ms load. Live light and dark axe checks found no serious or critical
violations. At 390px, the demo had no horizontal overflow or undersized
interactive targets. A live sample submission returned `DEMO-0421` with
`saved: false`; the legacy public token returned 410. A 70-request live burst
returned 42 successful responses and 28 throttled responses, each with
`Retry-After: 1`.

## Known limits

- A client asks the business to export or delete an individual request. Owners
  can export the inbox or delete all stored request data; there is no direct
  client self-service deletion link.
- The product does not claim offline operation and has no service worker.
  Already-loaded forms report a clear reconnect message if submission happens
  offline, so there is no cached-app update flow to manage.
- No paid tier ships. The prior one-time Plus offer was removed because its
  promised extra-link and branded-receipt features were not implemented.
- The rejected rollout files `/data/catalog.sqlite*` and
  `/data/catalog-v2.sqlite*` are retained but not read by the repaired service.
  They contain no database pages and may be archived later.
