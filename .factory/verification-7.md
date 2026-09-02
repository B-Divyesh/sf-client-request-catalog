# Independent verification 7 — PASS

**Candidate:** `0f5e9d9e2e59d5eef718975698d8c6845509f686`

**Live URL:** `https://client-request-catalog.sociobot.in`

**Verified:** 2026-09-02 UTC

**Verdict:** **PASS — candidate is ready for release.**

No release-blocking defect was found. The previous deployment-identity and
browser-history focus failures are resolved in the deployed candidate.

## First-read and one-click demo gate

A cold desktop and 390 × 844 mobile visit answered the required questions on
the first screen:

- What it does: **“Create private catalogs for repeat clients.”**
- Who it is for: small businesses that share prices and collect requests
  without checkout.
- What to click first: **Try it with sample data**, followed by “See a filled
  catalog in one click.”

The three plain facts ended at 563 px in the 844 px mobile viewport. One
keyboard-activated click opened `/demo`, which immediately showed three
realistic workshop offers and the persistent **“Demo — sample data, nothing
is saved”** banner with **Reset demo** and **Start for real**.

## Required claims gate

`.factory/claims.json` exists. Following `npm ci`, every listed command was
run separately and exactly as declared against a fresh server and demo state.
All 12 claims passed.

| Claim | Result | Evidence |
| --- | --- | --- |
| `owner-onboarding` | PASS | Claimed a fresh Entra test workspace, added an offer and client link, renamed the business, and read the branded catalog. |
| `entra-owner-auth` | PASS | Exact Sociobot CIAM authority/client ID, Microsoft redirect, no password field, and legacy password-header rejection. |
| `demo-isolated` | PASS | Demo submission left the real inbox unchanged. |
| `private-prices` | PASS | A 40-character opaque link exposed assigned prices and returned 410 after revocation. |
| `request-inbox` | PASS | A valid private-link request appeared in the owner inbox. |
| `owner-exports` | PASS | CSV header and `%PDF-1.4` signature verified. |
| `client-offer-visibility` | PASS | Separate links returned only their assigned offer IDs. |
| `individual-request-privacy` | PASS | One request was exported/deleted without exposing or deleting the other. |
| `deletion-audit-minimal` | PASS | The audit object contained only `request_id`, `action`, and `deleted_at`. |
| `generated-art-disclosure` | PASS | The footer visibly discloses Azure AI Foundry generation. |
| `no-trackers` | PASS | Landing and full demo flow requested only the product origin. |
| `no-checkout` | PASS | Demo submission stayed on the product origin and created no purchase. |

An invocation made before dependency bootstrap could not find `vite`, as
expected for a clean clone without `node_modules`. After the documented
`npm ci` prerequisite, all exact claim commands passed; this was an
environment bootstrap condition, not a failing product assertion.

The live landing, demo, privacy and terms copy and README were cross-checked
against the claims registry. No additional unregistered end-user promise was
found.

## Clean-checkout quality gates

| Check | Result |
| --- | --- |
| `npm ci` | PASS — 126 packages installed; 0 audit vulnerabilities. |
| `npm test` | PASS — 1/1 Node test. |
| `npm run check` | PASS — TypeScript and ESLint. |
| `npm run build` | PASS — production `dist/` produced. |
| `cargo fmt --manifest-path backend/Cargo.toml -- --check` | PASS. |
| `cargo test --locked --manifest-path backend/Cargo.toml` | PASS — 11/11. |
| `cargo clippy --locked --manifest-path backend/Cargo.toml --all-targets -- -D warnings` | PASS. |
| `cargo build --release --locked --manifest-path backend/Cargo.toml` | PASS. |
| `npm run test:e2e` | PASS — 14/14 browser tests. |

No Docker-compatible executable is installed in the verifier container, so a
local image build was unavailable. The exact Vite production build and locked
optimized Rust build passed. Inspection confirmed a multi-stage Dockerfile,
`rust:1-slim`, `ARG BUILD_SHA=dev`, no `.git` dependency, a non-root runtime
user, `/data`, port 8080, and the compiled server entry point.

The workspace arrived with pre-existing modifications only in four
`graphify-out` files. Product source matched the candidate throughout testing;
those unrelated files were neither reset nor included in this verification.

## Independent end-to-end and backend evidence

A release binary ran against a fresh temporary SQLite directory with a
test-only Entra identity.

- Unauthenticated setup and owner access returned 401. Blank and 121-character
  business names returned 400; a valid name returned 200; a second claim
  returned 409.
- One fixed-price and one price-on-application offer were created. A
  40-character private client token returned exactly those two offers and the
  configured business name.
- Client expiry values of 0 and 366 days returned 400; the normal 30-day link
  succeeded.
- Blank name, invalid email, no items, quantities 0/101, a 121-character name,
  a 2,001-character note, 31 items, and an unassigned offer all returned 400.
- The accepted boundaries were a 120-character name, 2,000-character note,
  30 items, and quantity 100. Normal and recovered requests also succeeded,
  receiving sequential `CRC-` references.
- Forty simultaneous valid requests from distinct client addresses produced
  40 × 200. The inbox contained all 43 accepted requests.
- CSV contained the documented header and request rows. The 2,763-byte PDF
  began `%PDF-1.4` and ended `%%EOF`.
- Individual deletion made that request export return 404. Its audit record
  retained exactly `request_id`, `action`, and `deleted_at`.
- Graceful shutdown logged the received signal. Restarting with the same data
  directory preserved the business name, two offers, one client, 42 remaining
  requests, and one deletion-audit record.
- Local `/health` returned the candidate SHA.

## Live deployment and rate limits

Fresh live `/health` evidence:

```json
{"build_sha":"0f5e9d9e2e59d5eef718975698d8c6845509f686","ok":true}
```

The deployed `index.html` and every file in local `dist/` matched the
candidate byte-for-byte, including the lazy authentication chunk and all
responsive images. The main document SHA-256 was
`6cc8fa7cf93a68d327ae0db0b6ca65c782afa61d1c4ac2c808eaff0756b35307`.

Fresh concurrent live bursts from one forwarded client identity produced:

| Bucket | Requests | Accepted | 429 | Observed allowance |
| --- | ---: | ---: | ---: | --- |
| Public read | 50 | 41 | 9 | 40-token burst plus one refill during the burst |
| Write | 20 | 16 | 4 | 16-token burst |
| Owner route | 12 | 8 (404 after limiter) | 4 | 8-token burst |
| Health | 50 | 50 | 0 | Exempt as documented |

Every 429 included `Retry-After: 1`.

Live owner endpoints rejected missing credentials and the legacy password
header with 401 and `WWW-Authenticate: Bearer`. `/api/auth/config` returned
only the expected authority
`sociobotcustomers.ciamlogin.com/35c6fe40-0ec0-46b6-98c6-213ad4de6650`
and client ID `25c704f4-465a-47af-80ab-2c489466b697`. Clicking Microsoft
sign-in requested that CIAM tenant. No password input exists.

## Browser, privacy, accessibility, and performance

- `/opt/fleet/lib/verify-url.sh` passed in 595 ms: title, `lang=en`, one H1,
  main landmark, image alt text, labeled buttons, and no browser errors.
- Independent Playwright axe scans on `/`, `/demo`, `/owner`, `/privacy`, and
  `/terms`, in both light and dark modes, found zero serious or critical
  violations. The designed 404 also had zero serious or critical findings.
- Desktop and 390 px mobile had no horizontal overflow. All visible mobile
  links, buttons, fields, and text areas measured at least 44 × 44 CSS px.
- The complete demo tab order was reachable without a trap. Every focused
  control had a 3 px clay focus outline. The first Tab exposed the skip link,
  and Enter focused `<main>`.
- Back and Forward moved focus to and announced the restored H1. This directly
  verifies the prior release blocker is fixed.
- Empty submission produced “Enter your name and a valid email address.” An
  invalid email exposed native validation. Correcting it produced “Sample
  request DEMO-0421 complete. Nothing was saved.” Reset returned the item
  count to zero.
- With the browser offline, submission reported “You are offline. Reconnect,
  then send your request.” The product is not a PWA and makes no offline-reload
  claim.
- Reduced-motion mode limited all animation and transition durations to
  0.00001 seconds.
- Landing plus complete demo activity contacted only
  `https://client-request-catalog.sociobot.in`; there were no analytics,
  remote fonts, trackers, payment calls, or other third-party requests.
- Browser-observed document headers included CSP with header-only
  `frame-ancestors 'none'`, HSTS, `nosniff`, same-origin referrer policy,
  frame denial, permissions restrictions, and `Cache-Control: no-store`.
  Hashed assets returned one-year immutable caching.
- All rendered internal links returned 200. `robots.txt`, `sitemap.xml`,
  favicon, Apple touch icon, social image, and all named routes returned the
  expected content. The designed unknown route returned HTTP 404 with a home
  link.
- Every route had a route-specific title, description, canonical URL, Open
  Graph metadata, Twitter card, one H1, one main landmark, and an ordered
  heading outline.
- Three mobile Lighthouse runs scored Performance **91/100/100**,
  Accessibility **100/100/100**, Best Practices **100/100/100**, and SEO
  **100/100/100**. Median FCP/LCP was 1,136 ms, median TBT 0 ms, CLS 0, and
  total transfer approximately 73 KB.
- Initial production JS is 29.68 KB raw / 9.20 KB gzip; CSS is 11.66 KB raw /
  3.29 KB gzip. The 269.75 KB auth chunk is lazy and absent from the landing
  request log. The mobile hero is 9.50 KB AVIF; no font files are shipped.

## Defects and known gaps

No critical, high, medium, or low product defect was found.

Informational: the researched subscription is not offered because the owned
Sociobot billing product is not enabled. The candidate makes no price,
checkout, or paid-feature promise, and the complete quote-request workflow is
available without it. Enabling a paid tier remains a product/business next
step rather than a release blocker.
