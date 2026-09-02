# Independent verification 6 — FAIL

**Candidate:** `44c50a4f48126b7490b8cc9eb489099b51f6cdb8`

**Live URL:** `https://client-request-catalog.sociobot.in`

**Verified:** 2026-09-02 UTC

**Clean checkout:** `/tmp/client-request-catalog-qa.bkzg9i`

**Verdict:** **FAIL — do not release this candidate**

## Release-blocking findings

### High — live build identity is not the candidate

Fresh `GET /health` evidence was:

```json
{"build_sha":"7a566ee7c5304ef8300e17a048e705a0bccaae6f","ok":true}
```

The required candidate is `44c50a4f48126b7490b8cc9eb489099b51f6cdb8`.
The live deployment therefore does not report the candidate's immutable build
identity. The live `index.html`, main JavaScript, CSS, lazy authentication
chunk, and image hashes do exactly match the candidate build. Commit
`7a566ee` is also a descendant of the candidate whose intervening tracked
changes are limited to handoff and graph-analysis files. Those facts show that
the visible product source is equivalent, but they do not satisfy the explicit
requirement that the deployed build match the candidate SHA.

### Medium — browser Back loses route focus

Keyboard navigation from `/` to **Privacy** correctly focused the destination
H1. Calling browser Back restored `/`, but focus moved to `<body>` instead of
the restored page's H1. The router only marks link-click navigation for focus;
it does not handle `popstate`. This violates the required back/forward and
screen-reader route-focus behavior. There was no keyboard trap, and the rest
of the keyboard flow passed.

## First-read and demo gate — PASS

A cold desktop and 390 × 844 visit plainly answers all three questions:

- What it does: **“Create private catalogs for repeat clients.”**
- Who it is for: **“Small businesses can share prices…”**
- What to click: **Try it with sample data**, followed by “See a filled
  catalog in one click.”

One click opened `/demo`, immediately displayed three realistic workshop
offers, and showed the persistent **“Demo — sample data, nothing is saved”**
banner with **Reset demo** and **Start for real**. The three short privacy and
workflow facts all ended above 729 px in the 844 px mobile viewport.

The demo rejected missing contact details, exposed native invalid-email
feedback, recovered after correction, and returned: “Sample request
DEMO-0421 complete. Nothing was saved.” Reset returned the item count to zero.

## Required claims gate — PASS

`.factory/claims.json` exists. After `npm ci`, every listed command was run
separately and exactly as declared. Logs are under
`/tmp/client-request-catalog-qa-logs/claim-<id>.log`.

| Claim | Result | Observable evidence |
| --- | --- | --- |
| `owner-onboarding` | PASS | Owner setup, offer/link creation, rename, and branded client catalog completed. |
| `entra-owner-auth` | PASS | Exact CIAM authority/client ID, Microsoft redirect, no password field, and legacy header rejection. |
| `demo-isolated` | PASS | Demo submission did not change the real inbox. |
| `private-prices` | PASS | 40-character client token opened assigned prices; revocation returned 410. |
| `request-inbox` | PASS | A valid browser request appeared in the owner inbox. |
| `owner-exports` | PASS | CSV header and `%PDF-1.4` signature verified. |
| `client-offer-visibility` | PASS | Two links returned distinct assigned offer IDs. |
| `individual-request-privacy` | PASS | One request exported/deleted without exposing or deleting the other. |
| `deletion-audit-minimal` | PASS | Audit object contained only `request_id`, `action`, and `deleted_at`. |
| `generated-art-disclosure` | PASS | Footer disclosure is visible. |
| `no-trackers` | PASS | Landing/demo flow requested only the product origin. |
| `no-checkout` | PASS | Demo submission stayed on product origin and created no purchase. |

The live landing page and README were cross-checked against the registry. No
additional visitor-facing claim missing from the claim contract was found.

## Clean-clone quality gates

| Check | Result |
| --- | --- |
| `npm ci` | PASS — 126 packages, 0 audit vulnerabilities. |
| `npm test` | PASS — 1/1 Node test. |
| `npm run check` | PASS — TypeScript and ESLint. |
| `npm run build` | PASS — production `dist/` produced. |
| `cargo fmt --manifest-path backend/Cargo.toml -- --check` | PASS. |
| `cargo test --locked --manifest-path backend/Cargo.toml` | PASS — 11/11. |
| `cargo clippy --locked --manifest-path backend/Cargo.toml --all-targets -- -D warnings` | PASS. |
| `cargo build --release --locked --manifest-path backend/Cargo.toml` | PASS. |
| `npm run test:e2e` | PASS — 13/13 in an isolated run. |

An initial E2E attempt deliberately overlapped the full Rust release compile
and missed its synthetic long-task threshold (167 ms versus `<100 ms`). The
same exact command passed all 13 tests after the competing compile finished;
live Lighthouse also passed the performance threshold. This was environment
contention, not a reproducible product failure.

No Docker, Podman, Buildah, nerdctl, or buildctl executable is installed in
the verifier container, so a local image build was unavailable. The exact Vite
production build and locked optimized Rust build both passed. The Dockerfile
was inspected: it is multi-stage, uses `rust:1-slim`, declares
`ARG BUILD_SHA=dev`, runs as a non-root user, exposes 8080, and does not depend
on `.git`.

The clean candidate checkout remained free of tracked changes after testing.

## Independent workflow and backend evidence

A release binary ran against a fresh temporary SQLite directory with a test-only
Entra identity.

- First-owner setup rejected missing authentication, blank and 121-character
  business names, accepted a real name, and rejected a second claim with 409.
- It created one fixed-price and one POA offer. Separate client links exposed
  only their assigned offer.
- Client expiry boundaries of 1 and 365 days passed; 0 and 366 failed. Tokens
  were opaque 40-character values. Unknown and revoked links returned 410.
- Blank name, invalid email, no items, quantities 0/101, 31 items, a
  121-character name, a 2,001-character note, and an unassigned offer all
  returned 400. A 120-character name, 2,000-character note, 30 items, and
  quantity 100 were accepted.
- A normal request received `CRC-000001`. Forty simultaneous valid requests
  from distinct client addresses produced **40 × 200** and all persisted.
- CSV, single-request CSV, and PDF exports returned the expected MIME types,
  header row, contact row, and `%PDF-1.4` signature.
- Individual deletion made that export return 404 while other requests
  remained. Its audit record retained exactly the three registered fields.
- SIGTERM logged `shutdown received` with `signal:"Terminate"`. Restarting
  against the same directory retained the owner, name, two offers, two client
  records, and 41 remaining requests.
- Local `/health` returned the candidate SHA.

The live Entra configuration uses only
`sociobotcustomers.ciamlogin.com/35c6fe40-0ec0-46b6-98c6-213ad4de6650`, client
ID `25c704f4-465a-47af-80ab-2c489466b697`, and redirect URI
`https://client-request-catalog.sociobot.in/auth/callback`. A real sign-in
click generated an OAuth authorization-code request to that tenant. There is
no password input.

### Live rate limits

Fresh concurrent bursts from one forwarded client identity produced:

| Bucket | Requests | Accepted | 429 | Observed allowance |
| --- | ---: | ---: | ---: | --- |
| Public read | 50 | 41 | 9 | 40-token burst plus one refill during the burst |
| Write | 20 | 16 | 4 | 16-token burst |
| Owner route | 12 | 8 | 4 | 8-token burst |

Every 429 included `Retry-After: 1`. Fifty health requests remained 200, as
documented. The required server-side allowance is therefore enforced.

## Browser, privacy, accessibility, and performance

- Desktop, 390 px mobile, light, dark, and reduced-motion checks passed on
  `/`, `/demo`, `/owner`, `/privacy`, and `/terms`. No horizontal overflow,
  page errors, regular-route console errors, or visible target below 44 × 44
  px was found.
- Playwright axe reported zero serious or critical findings on every checked
  route/theme. Reduced motion left zero meaningful animated elements.
- The first Tab exposed a designed skip link; Enter focused `<main>`. Form
  errors use a live region and corrected input submitted successfully. The
  browser-Back focus defect is recorded above.
- `/opt/fleet/lib/verify-url.sh` passed: 591 ms load, title, `lang=en`, one H1,
  main landmark, complete alt text, labeled buttons, and no console errors.
- `npx @axe-core/cli` could not pair its Selenium ChromeDriver with the
  preinstalled Playwright Chromium. The repository's installed Playwright axe
  integration completed the required equivalent scans.
- Landing and complete demo request logs contained only
  `https://client-request-catalog.sociobot.in`. No analytics, remote fonts,
  trackers, billing calls, or other third-party runtime requests occurred.
- Root responses include CSP with header-only `frame-ancestors 'none'`, HSTS,
  `nosniff`, same-origin referrer policy, frame denial, permissions policy,
  and `Cache-Control: no-store`. Hashed assets use one-year immutable caching.
- All crawled internal links returned 200. `robots.txt`, `sitemap.xml`, icons,
  all named routes, and the designed HTTP 404 behaved correctly. Each route
  has its own title, canonical, description, one H1, and one main landmark.
- Mobile Lighthouse: Performance **99**, Accessibility **100**, Best
  Practices **100**, SEO **100**; FCP/LCP 1,303 ms, TBT 114 ms, CLS 0, and
  72,496 transferred bytes.
- Production assets: initial JS 29.18 KB raw / 9.10 KB gzip; CSS 11.66 KB raw /
  3.29 KB gzip; mobile hero AVIF 9.50 KB. The 269.75 KB authentication chunk is
  lazy and was not loaded on the landing page.

This product is not a PWA, library, or CLI, and makes no offline-reload claim.
The demo presents clear offline submission recovery, which passed the browser
suite.

## Scope deviation and next steps

The researched monetization is not implemented. A fresh request to the owned
product checkout URL still returned
`404 {"error":"enabled factory product","status":404}`. The candidate is
honest: it advertises no plan or unavailable checkout. Subscription remains a
documented gap until the factory billing product is enabled.

Before release:

1. Fix `popstate` rendering so Back and Forward focus and announce the newly
   restored H1.
2. Produce a new candidate, deploy that exact build identity, and verify that
   live `/health.build_sha` equals the candidate SHA.
3. Repeat claims, keyboard history, and deployment-identity checks.
