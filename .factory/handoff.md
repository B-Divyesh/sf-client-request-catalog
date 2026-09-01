# Client Request Catalog — repair handoff

## Outcome

The release blockers in independent verification commit
`1c0c4ecdc407b37fa6dcfb0d8938bfbb82aa5bb2` and
`.factory/verification-2.md` are repaired.

- Owners now control the exact offer list for every client link. Each client
  catalog joins `client_products`, so an unassigned offer is not returned or
  accepted in a request.
- The owner workspace creates a link with checked offers and lets the owner
  change that list later. New offers are unassigned until the owner selects
  them for a client.
- `GET /api/admin/requests/:id.csv` exports only that request. It cannot
  include another client's data.
- `DELETE /api/admin/requests/:id` removes the selected request and its items
  in one transaction. It writes an audit row containing only internal request
  ID, action, and date; it retains no name, email, contact detail, note,
  client-link token, or request reference.
- The existing full-inbox delete path now produces the same data-minimal audit
  records for every removed request.

## Reproduction before repair

Against a fresh isolated server built from the verifier candidate,
`GET /api/admin/requests/1.csv` returned **405** and
`DELETE /api/admin/requests/1` returned **405**. Two separately created links
for Client Alpha and Client Beta each returned all three seeded offers:
Quarterly maintenance visit, Replacement fitting set, and Repeat consumables
pack.

The repaired local exercise created Alpha with offer 1 and Beta with offer 2.
Their catalog responses contained respectively only `Quarterly maintenance
visit` and only `Replacement fitting set`.

## Data migration and isolation

SQLite remains local to this product under `/data/catalog-live.sqlite`; no
shared database or other service is used. The compatible one-time migration
adds `client_products`, `request_deletion_audit`, and a migration marker. It
copies visible offers to pre-existing links once, preserving their prior
catalogs while allowing owners to narrow them afterwards. Owner-created
assignments are explicit. The service stays at one SQLite connection and one deployed
replica.

## Regression coverage

Two claims were added to `.factory/claims.json`:

- `@claim:client-offer-visibility` creates two links, proves their catalogs
  differ, changes Alpha through the owner browser UI, and proves Beta is
  unchanged.
- `@claim:individual-request-privacy` creates two requesters, exports only one
  CSV, deletes that request through the owner browser UI, and proves the other
  remains while the deleted export returns 404.

Rust integration tests repeat both boundary checks. The audit test asserts the
only audit columns are `id`, `request_id`, `deleted_at`, and `action`. The
pre-existing 40-concurrent-request regression remains green.

## Verification

Run from a clean dependency install:

```sh
npm ci --ignore-scripts
npm test
npm run check
npm run build
cargo fmt --manifest-path backend/Cargo.toml -- --check
cargo test --manifest-path backend/Cargo.toml
npm run test:e2e
```

All commands passed on 2026-09-01 UTC. Results:

- Node unit tests: 1 passed.
- Rust integration/unit tests: 8 passed.
- Playwright Chromium: 13 passed, including each of the eight declared claim
  commands run separately.
- Browser coverage includes desktop, 390px mobile, keyboard skip/focus,
  light/dark axe, owner UI changes, privacy request logging, offline submission
  failure messaging, response headers, cache policy, 404, and rate limiting.
- Built frontend: 23.67 KB JavaScript (7.73 KB gzip) and 11.26 KB CSS
  (3.16 KB gzip).
- Local `verify-url.sh` passed with one h1, `lang=en`, a main landmark, no
  missing image alt text, no unnamed buttons, and no browser console errors.
- Mobile Lighthouse: Performance 100, Accessibility 100, Best Practices 100,
  SEO 100; LCP 1.808 s, CLS 0, TBT 0 ms.

The exact container build was performed by ACR. There is no local Docker or
Podman executable in this worker image.

## Deployment evidence

The repaired runtime source at `83d5b8289fdc640af3ef82749a0fcc1367ec3f42`
completed the factory ACR build and was deployed with
`WO_DATA_DIR=/data` through the product's own `sf-client-request-catalog`
container configuration. The durable `/data` mount and one-replica SQLite
setting were retained. No other product resource was read or changed.

Live checks at `https://client-request-catalog.sociobot.in` passed:

- `/health` returned 200 with that exact `build_sha`.
- `verify-url.sh` reported a 608 ms load, one h1, `lang=en`, a main landmark,
  complete image alt text, named buttons, and no browser console errors.
- Live light and dark axe scans found no serious or critical findings.
- At 390px there was no horizontal overflow or undersized interactive target;
  the skip link received focus with the first Tab.
- The live landing/demo flows requested only
  `https://client-request-catalog.sociobot.in`.
- `/api/demo/catalog` returned 200, the retired `demo-client` link returned
  410, and an unknown route returned 404.

## Operate

```sh
npm ci
npm run build
cargo run --manifest-path backend/Cargo.toml
```

The server starts on `PORT` (default 8080) without required environment
variables. It persists SQLite and a generated owner code under `/data`. Open
`/owner`, enter the code from `/data/owner-code.txt`, choose visible offers on
each client link, and use the request-row controls for individual export or
deletion. Use `/demo` for the isolated non-persistent sample.

## Known limits

- The product does not claim offline use and has no service worker. Loaded
  forms report a clear reconnect message if a submission is attempted offline.
- No paid tier ships. This remains a quote-request catalog, not checkout.
