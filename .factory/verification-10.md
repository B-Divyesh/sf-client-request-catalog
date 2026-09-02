# Independent verification 10 — PASS

**Candidate:** `c8aff8d0ff0da15271acd4462738224748bd4e52`  
**Live URL:** `https://client-request-catalog.sociobot.in`  
**Verified:** 2026-09-02 UTC  
**Verdict:** **PASS — release candidate accepted.**

## First read and demo gate

A cold desktop visit returned 200 with no console errors. The first screen
answers the required questions in plain words: **“Create private catalogs for
repeat clients”**; it is for small businesses sharing private prices and
collecting request details; and **“Try it with sample data”** says one click
opens a filled owner workspace. The action opens `/?demo=1`, with a persistent
“Demo — sample data, nothing is saved” banner, Reset demo, a real-start action,
three offers, two client links, and three requests.

At 390×844 the demo had no horizontal overflow. It rejected an empty request
with “Choose at least one offer before sending.” After selecting an offer and
entering contact details, it confirmed a sample-only request; browser traffic
was same-origin GET only and storage remained empty.

## Claims gate — PASS

`npm ci` installed 132 packages with zero reported vulnerabilities. Every
exact test command in `.factory/claims.json` ran after that install, and passed
using the supplied demo/test entry point:

| Claim IDs | Result |
| --- | --- |
| one-click-owner-demo; demo-isolated; owner-onboarding; entra-owner-auth | PASS |
| private-prices; request-inbox; request-data-stored; request-status-updates | PASS |
| owner-exports; client-offer-visibility; mixed-price-modes; offer-maintenance | PASS |
| csv-offer-import; individual-request-privacy; deletion-audit-minimal | PASS |
| generated-art-disclosure; no-trackers; no-checkout; free-access | PASS |
| online-required; operator-config | PASS |

The final clean `npm run test:e2e` passed **23/23**. Its result file records
`{"status":"passed","failedTests":[]}`. A direct `playwright test` run was
not used as a gate because it bypasses `scripts/prepare-e2e.mjs`; its expected
fresh-database assumption failed after an earlier run. The prescribed npm
entry point clears that state and passed.

## Local quality gates — PASS

| Command | Evidence |
| --- | --- |
| `npm test` | 3/3 passed |
| `npm run check` | TypeScript and ESLint passed |
| `npm run audit:copy` | passed |
| `npm run build` | passed; `dist/` produced |
| `cargo fmt --manifest-path backend/Cargo.toml -- --check` | passed |
| `cargo test --locked --manifest-path backend/Cargo.toml` | 11/11 passed |
| `cargo clippy --locked --manifest-path backend/Cargo.toml --all-targets -- -D warnings` | passed |
| `cargo build --release --locked --manifest-path backend/Cargo.toml` | passed |
| `npm run test:runtime -- --test-name-pattern=@claim:operator-config` | 1/1 passed |
| `npm run test:e2e` | 23/23 passed |

Docker and Podman are not installed in this verifier container, so a local
container-image build/run was unavailable. The locked release binary build
passed and the live identity below matches the candidate.

## Live deployment, functionality, and backend

- `GET /health` returned 200 and
  `{"build_sha":"c8aff8d0ff0da15271acd4462738224748bd4e52","ok":true}`.
- `/`, `/demo`, `/owner`, `/privacy`, `/terms`, robots, and sitemap returned
  200. A missing route returned a styled 404.
- The live verification script exercised seeded owner/demo data, Reset demo,
  sample CSV/PDF export parsing, internal links, keyboard focus, desktop and
  mobile layout, and client submission recovery. The claim suite covers the
  authenticated owner lifecycle, fixed and quote-first offers, private
  visibility, expiry/revocation, SQLite persistence, exports, minimal deletion
  audit, and 40 concurrent writes.
- The owner auth configuration points at
  `https://sociobotcustomers.ciamlogin.com/35c6fe40-0ec0-46b6-98c6-213ad4de6650/`;
  no password input or alternate owner sign-in exists.
- Rate limiting is enforced live. A 60-request same-forwarded-client owner API
  burst yielded 39 HTTP 429 responses with `Retry-After: 1`; 21 reached the
  route. A sequential fresh-client probe first observed 429 at request 12.
  The source policy is an owner burst of 8 per instance, so the larger observed
  live allowance is consistent with traffic reaching multiple live instances.

## Privacy, accessibility, headers, and budgets

- Playwright Axe reported zero serious/critical findings on every main route
  and the 404. There was one H1 and a main landmark per route, valid titles and
  canonical metadata, visible keyboard focus, route-focus restoration, and no
  390 px overflow. No console/page errors occurred.
- A browser request log over landing, demo, legal, and sample client flow
  contained only the product origin. No trackers, remote fonts, advertising,
  checkout, or third-party requests were seen.
- CSP is delivered as a response header with `frame-ancestors 'none'`; HSTS,
  `X-Content-Type-Options: nosniff`, DENY framing, same-origin referrer policy,
  permissions policy, and appropriate caching are present. HTML is `no-store`;
  hashed assets are `public, max-age=31536000, immutable`.
- Initial landing JS is 42.54 KB (13.07 KB gzip), CSS is 12.52 KB (3.48 KB
  gzip), and the 390 px AVIF is 9,498 bytes. The 269.75 KB auth chunk is lazy
  and not loaded by the landing route.

## Defects by severity

| Severity | Findings |
| --- | --- |
| Critical | None |
| High | None |
| Medium | None |
| Low | None |
| Informational | Local Docker/Podman are unavailable. The product is currently free despite the researched subscription opportunity; its copy states this accurately. |
