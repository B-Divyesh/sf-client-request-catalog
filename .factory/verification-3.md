# Independent verification 3 — FAIL

**Candidate:** `cf2bf3ce8d3e07e52688f21e42b5103e6a6caa84`
**Live URL:** `https://client-request-catalog.sociobot.in`
**Verified:** 2026-09-01 UTC
**Verdict:** **FAIL — do not release**

## Release-blocking findings

1. **High — an intended business cannot start or brand a real catalog.**
   The brief requires a branded catalog for a small service or goods business.
   On the live demo, **Start for real** returns to `/`, which only offers the
   sample demo. The owner route asks for a code from the server file
   `/data/owner-code.txt`; a normal hosted customer has no product flow for
   obtaining that file. In a fresh local database, both the owner overview and
   a newly created real client catalog returned `business_name: "Field &
   Form"`. That value is hard-coded in `backend/src/main.rs` at lines 479 and
   696, and there is no business-name or brand setting. The request mechanics
   work, but the smallest useful product cannot be adopted end to end by its
   stated user without operator access and source changes.

2. **High — a live privacy statement is not registered in the required claim
   contract.** `/privacy`, the owner workspace, and README state that deletion
   retains only an internal request ID, action, and date. `.factory/claims.json`
   has no claim for those retained fields. The closest tagged test,
   `@claim:individual-request-privacy`, confirms one-request export/deletion,
   another request remaining, and a later `404`; it does not check the retained
   audit fields. A separate Rust test checks the schema, but it is not connected
   to the listed claim command. Under the supplied claims contract, an unlisted
   product statement is release-blocking.

## Other findings

1. **Medium — write and owner-authentication routes do not have the required
   stricter allowance.** One shared token bucket covers every route except
   `/health`: 20 requests/second with burst 40. The common limit works, but the
   backend acceptance contract calls for stricter limits on write and
   authentication routes.
2. **Medium — the researched subscription path is absent.** The live product
   has no plan, price, subscription setup, or billing-engine handoff. This does
   not affect the demonstrated request flow, but it does not implement the
   brief's stated subscription model.
3. **Low — the three short product facts fall below the initial 390 × 844
   viewport.** The headline, audience sentence, and sample-data action are
   visible and the first-read gate passes, but the required privacy/access
   facts need a short scroll on that viewport.
4. **Low — the optional strict Rust lint check is not clean.** `cargo clippy
   --locked --manifest-path backend/Cargo.toml --all-targets -- -D warnings`
   reports two `result_large_err` findings and one `useless_vec` finding. This
   command is not a configured repository gate; the configured TypeScript and
   ESLint checks pass.

## Required first-read and demo checks

Checked a cold live load at desktop and 390 × 844.

- Confirmed the page says what it does: “Create private catalogs for repeat
  clients.”
- Confirmed it names the intended audience: small businesses sharing prices
  and collecting requests.
- Confirmed the first action is visible: **Try it with sample data**, followed
  by “See a filled catalog in one click.”
- Confirmed one click opens `/demo` with three realistic offers already loaded.
- Confirmed the persistent demo banner says sample data is not saved and
  includes **Reset demo** and **Start for real**.
- Confirmed an empty submission explains that an offer is required; an invalid
  email explains what to correct; correcting it completes `DEMO-0421` and says
  nothing was saved.

The first-read gate itself passes. The real-start path described in finding 1
does not.

## Claim gate

The required file exists. Each listed command was run separately first from a
clean clone at the candidate commit and through the repository's demo entry
point.

| Claim | Result | Observed evidence |
| --- | --- | --- |
| `@claim:demo-isolated` | Pass | 1 Playwright test passed; demo submission stayed on demo routes and did not change the owner inbox. |
| `@claim:private-prices` | Pass | 1 test passed; root and retired token showed no price, a 40-character link worked, and revocation returned 410. |
| `@claim:request-inbox` | Pass | 1 test passed; a browser request appeared in the authenticated inbox. |
| `@claim:owner-exports` | Pass | 1 test passed; CSV header and `%PDF-1.4` signature confirmed. |
| `@claim:no-trackers` | Pass | 1 test passed; landing and demo used only the product origin. |
| `@claim:no-checkout` | Pass | 1 test passed; the request completed on the product origin and the terms remained explicit. |
| `@claim:client-offer-visibility` | Pass | 1 test passed; two links opened different assigned offers and an update remained isolated. |
| `@claim:individual-request-privacy` | Pass | 1 test passed; a single export omitted the other requester and deletion preserved the other request. |

The separate claim-registration finding above still makes the claim contract
incomplete.

## Clean-clone quality gates

Clean clone: `/tmp/client-request-catalog-qa.fZlnCc` at the candidate SHA.
The clone remained free of tracked changes after testing.

| Check | Result |
| --- | --- |
| `npm ci` | Pass; 124 packages installed, 0 reported vulnerabilities. |
| `npm test` | Pass; 1/1 Node test. |
| `npm run check` | Pass; TypeScript and ESLint. |
| `npm run build` | Pass; `dist/` produced. |
| `cargo fmt --manifest-path backend/Cargo.toml -- --check` | Pass. |
| `cargo test --manifest-path backend/Cargo.toml` | Pass; 8/8 tests. |
| `npm run test:e2e` | Pass; 13/13 Chromium tests. |
| `cargo build --release --locked --manifest-path backend/Cargo.toml` | Pass. |
| Exact container build | Not run; no Docker or Podman executable is installed in this verifier. Dockerfile inspection and the live build identity checks passed. |

Production build sizes are 23.67 KB JavaScript (7.73 KB gzip), 11.26 KB CSS
(3.16 KB gzip), and 134.67 KB for the responsive hero image. They are within
the supplied budgets.

## Independent end-to-end and backend checks

Checked the release binary against a fresh temporary SQLite directory.

- Confirmed startup with no supplied owner code generates a 28-character code,
  persists it beside SQLite, does not print it, and reuses it after restart.
- Confirmed `/health` returns the supplied build SHA.
- Confirmed an unauthenticated owner overview returns 401.
- Confirmed blank client names, expiry values 0 and 366, and unknown offer IDs
  return 400. Valid 1-day and 30-day links returned independent 40-character
  tokens.
- Confirmed an Alpha link assigned offers 1 and 2 opened only those offers; a
  Beta link assigned offer 3 opened only offer 3. Unknown and retired demo
  tokens returned 410.
- Confirmed empty names, malformed email, no items, quantities 0 and 101, an
  unassigned offer, and a 2,001-character note return 400 with recovery text.
- Confirmed the accepted boundaries: 120-character name, 2,000-character note,
  30 items, and quantity 100.
- Confirmed a corrected keyboard/browser submission produced `CRC-000002` and
  appeared in the owner inbox.
- Confirmed full CSV, one-request CSV, and PDF exports; the PDF starts with
  `%PDF-1.4`.
- Confirmed valid status updates, invalid-status rejection, one-request
  deletion, a 404 for its later export, preservation of other requests, and a
  data-minimal audit count.
- Confirmed 40 simultaneous valid submissions from distinct client identities
  all returned 200 and increased the inbox by exactly 40.
- Confirmed 42 stored requests remained after graceful shutdown and restart.

## Live deployment, privacy, accessibility, and performance

- `/health` returned 200 with build SHA
  `cf2bf3ce8d3e07e52688f21e42b5103e6a6caa84`.
- The live HTML, JavaScript, CSS, and hero-image SHA-256 values match the clean
  candidate build.
- `/`, `/demo`, `/owner`, `/privacy`, and `/terms` returned 200; an unknown
  route returned the styled document with status 404. `robots.txt`,
  `sitemap.xml`, favicon, Apple icon, and 1200 × 630 social image returned 200.
- Live response headers include CSP with `frame-ancestors 'none'`, HSTS,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`,
  `X-Frame-Options: DENY`, and a restrictive Permissions Policy. HTML/API
  responses use `no-store`; fingerprinted assets use a one-year immutable
  cache policy.
- A 300-request concurrent check from one client identity observed 49 responses
  at 200 while the bucket refilled and 251 at 429. Every 429 included
  `Retry-After: 1`. The source policy is 20 requests/second with burst 40.
- The complete live landing-to-demo flow requested only
  `https://client-request-catalog.sociobot.in`; no outside script, font,
  analytics, or tracker request appeared. No console or page errors appeared.
- Light and dark checks on all five public routes found zero serious or
  critical axe issues. Every route has `lang=en`, one `h1`, one `main`, header,
  footer, image alternatives, and no horizontal overflow.
- At 390 px, all visible controls measured at least 44 × 44 CSS px. The first
  Tab focuses the visible skip link with a 3 px outline; Enter focuses `main`;
  route navigation focuses the next page heading.
- A reduced-motion context reported all animation and transition durations as
  0.01 ms.
- Mobile Lighthouse: Performance 99, Accessibility 100, Best Practices 100,
  SEO 100; FCP 1.1 s, LCP 1.9 s, TBT 0 ms, CLS 0, total transfer 168 KiB.

This product is not a PWA and makes no offline-use claim, so service-worker
update and offline-reload checks are not applicable. It is not a library or
CLI. It does not require identity-provider sign-in and has no paid feature or
product-license call.

## Decision

**FAIL.** Keep the candidate unreleased until a hosted business can start a
real workspace and set its business identity, every live/README claim is
registered with a matching tagged check, and write/owner routes have a
documented stricter allowance. Re-run all eight existing claim commands plus
the new claim checks after repair.
