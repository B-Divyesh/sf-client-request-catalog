# Independent verification 8 — PASS

**Candidate:** `466f5075d08dfb928a70a5c55525c488d33f8dd5`  
**Live URL:** `https://client-request-catalog.sociobot.in`  
**Verified:** 2026-09-02 UTC  
**Verdict:** **PASS — ready for release.**

No critical, high, medium, or low product defect was found. The live health
identity matches the candidate exactly:

```json
{"build_sha":"466f5075d08dfb928a70a5c55525c488d33f8dd5","ok":true}
```

## First read and demo gate

A new, cold browser visit gave a clear answer within the first screen:

- **What it does:** “Create private catalogs for repeat clients.”
- **Who it is for:** small businesses sharing prices and collecting requests
  without running checkout.
- **What to do first:** click **Try it with sample data**; adjacent copy says
  it opens a filled owner workspace in one click.

The three plain facts are visible: free to use, internet connection required,
and no analytics or tracking. The one click opened `/?demo=1` with the
persistent “Demo — sample data, nothing is saved” banner, Reset demo and Set
up your catalog controls, three offers, two client links, and three requests.

## Required claims gate

`.factory/claims.json` exists with 19 entries. From a clean temporary clone at
the tested candidate, I installed dependencies with `npm ci` and ran every
exact command declared in that file against the supplied demo/test entry
points. **All 19 passed.** The full `npm run test:e2e` follow-up also passed
all 21 browser tests.

| Claim groups | Result | Observable evidence |
| --- | --- | --- |
| Owner demo, demo isolation, mixed price modes, offer maintenance, CSV import | PASS | Filled memory-only sample, reset, fixed and quote-first selections, lifecycle actions, duplicate-skipping import and undo. |
| Entra setup and private price controls | PASS | Sociobot Entra-only owner test flow; opaque 40-character links; expiry/revocation and client-specific offer visibility. |
| Request inbox and privacy controls | PASS | Valid request reaches owner inbox; CSV/PDF export; individual export/delete preserves other request; minimal deletion audit. |
| Public wording, disclosure, privacy, and no checkout | PASS | Azure AI Foundry disclosure, no tracker calls, free-access fact, internet-required initial load, no payment/reservation behavior. |
| Operator configuration | PASS | `DATA_DIR` persistence and Entra environment overrides through the runtime claim. |

Landing/demo/legal/README promise wording was cross-checked with the registry;
no unlisted visitor-facing claim was found.

## Clean-checkout quality gates

| Check | Result |
| --- | --- |
| `npm ci` | PASS — 129 packages audited, 0 vulnerabilities. |
| `npm test` | PASS — 3/3. |
| `npm run check` | PASS — TypeScript and ESLint. |
| `npm run build` | PASS — production `dist/` produced. |
| `cargo fmt --manifest-path backend/Cargo.toml -- --check` | PASS. |
| `cargo test --manifest-path backend/Cargo.toml` | PASS — 11/11. |
| `cargo clippy --locked --manifest-path backend/Cargo.toml --all-targets -- -D warnings` | PASS. |
| `cargo build --release --locked --manifest-path backend/Cargo.toml` | PASS. |
| `npm run test:runtime -- --test-name-pattern=@claim:operator-config` | PASS — 1/1. |
| `npm run test:e2e` | PASS — 21/21. |

Vite reported 40.69 KB (12.42 KB gzip) main JavaScript, 269.75 KB (67.60 KB
gzip) lazy-only authentication JavaScript, and 12.44 KB (3.46 KB gzip) CSS.
The cold landing requested no lazy auth chunk. A local Docker image build could
not be executed because this verifier container has no `docker` executable;
the deployed container's matching health identity plus the exact Vite and
locked release-Rust builds provide the available production-build evidence.

## Functional, deployment, and backend evidence

- The full browser and Rust suites cover normal requests, invalid contacts and
  selections, quantity/name/note/item-count boundaries, corrected recovery,
  private-link expiry/revocation, CSV/PDF, request deletion, restart
  persistence, and 40 concurrent valid requests.
- A fresh local server using a temporary SQLite directory returned the exact
  candidate SHA from `/health` and started with only `PORT`, `DATA_DIR`, and
  `BUILD_SHA` supplied for the test.
- Live routes `/`, `/privacy`, `/terms`, `/demo`, `/robots.txt`,
  `/sitemap.xml`, and the hashed application asset returned 200. The legal and
  demo routes had route-specific titles, H1s, descriptions, and canonicals.
- The live public limiter was independently exercised with 120 concurrent
  requests from one client. 44 returned the route's normal 410 response; 76
  returned **429**, beginning at request 40. Every 429 had `Retry-After: 1`.
  This confirms a 40-request public burst allowance. Health remained exempt as
  documented.
- The Rust tests independently cover the stricter write/owner buckets,
  concurrency, persistence, and health behavior.

## Browser, privacy, accessibility, and performance

- Fresh cold landing request log: only product-origin HTML, CSS, JS, and its
  self-hosted AVIF image; no console/page errors.
- Across landing, demo, privacy, terms, and the 404 navigation, the Playwright
  request log had no third-party origin. The only allowed future identity
  origin in CSP is `sociobotcustomers.ciamlogin.com`.
- Desktop and 390 × 844 mobile: exactly one H1 and one main landmark, no
  horizontal overflow, visible solid focus outline, first Tab reveals the skip
  link, and Enter moves focus to `main`.
- Playwright axe found **zero serious or critical violations** on both desktop
  and mobile (zero violations at all). `prefers-reduced-motion: reduce`
  reduced animation and transition duration to 0.00001 s.
- Live headers include header-delivered CSP with `frame-ancestors 'none'`,
  HSTS, `nosniff`, `same-origin` referrer policy, `DENY` framing, restrictive
  permissions policy, and no-store documents. Hashed assets are one-year
  immutable cached.
- Mobile Lighthouse: **Performance 100**, **Accessibility 100**, LCP
  **1,352 ms**, CLS **0**, and total transfer **84,762 bytes**. No Lighthouse
  run warnings.

The repository did not supply the referenced `verify-url.sh`; equivalent
title/lang/H1/main/alt/console checks were performed directly in Playwright.

## Defects by severity

| Severity | Defects |
| --- | --- |
| Critical | None. |
| High | None. |
| Medium | None. |
| Low | None. |
| Informational / QA environment | Docker is unavailable in the verifier container, so local image creation was not runnable. This is not a candidate defect; live `/health` proves the deployed image is this candidate. |
