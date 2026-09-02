# Independent verification 9 — FAIL

**Candidate:** `f75e3f244969f3e6d49898b829b1c0343268cc0d`

**Live URL:** `https://client-request-catalog.sociobot.in`

**Verified:** 2026-09-02 UTC

**Verdict:** **FAIL — do not release this candidate.**

The product works end to end and the live deployment is the candidate, but a
required repository gate is reproducibly non-green. The README also contains a
visitor-facing capability claim that is absent from `.factory/claims.json`.
Both are release blockers under this work order.

## Release-blocking findings

### High — the required browser suite does not pass reliably

`npm run test:e2e` completed 21 of 22 tests and failed
`mobile landing uses the small hero and keeps auth work off the main route`.
The test applies 4× CPU throttling and requires measured long-task blocking to
remain below 100 ms; the clean full-suite run measured **206 ms**.

Controlled repeats reproduced the failure:

- default repeat run: 4 of 5 failed at 149, 175, 184, and 205 ms;
- serial repeat run (`--workers=1`): 2 of 5 failed at 102 and 124 ms.

This is not evidence that the deployed page is generally slow: five equivalent
live samples measured 26–89 ms, and Lighthouse scored 100 with 0 ms TBT. It is
evidence that the repository's required quality gate is unstable and cannot be
reported as passing. The definition of done requires all tests to pass.

### Medium — “update requests” is an unregistered claim

README says: **“They can review, update, export, or delete requests.”** The
registry has claims for inbox receipt, export, and deletion, but no claim for
updating a request or its status. No `@claim:*` test covers that promise. The
claims contract requires every visitor-facing claim to be listed and tagged;
the existing registry-completeness test only checks registered entries and
cannot discover an omitted claim.

## First-read and demo gate — PASS

A cold 1440 px visit answers the required questions in plain words:

- What: **“Create private catalogs for repeat clients.”**
- Who: small businesses sharing private prices and collecting request details.
- First action: **Try it with sample data**, beside “One click opens a filled
  owner workspace.”

The primary action opens `/?demo=1` with the persistent sample-data banner,
Reset demo, Set up your catalog, three offers, two private client links, and
three requests. The first screen also states free use, internet required, and
no analytics or tracking. Keyboard Enter activates the same one-click demo.

## Claims gate — 20/20 PASS after clean install

The clean clone initially had no `node_modules`, so the pre-install browser
claim invocations could not resolve `vite`; the runtime claim passed. After the
required `npm ci`, every exact command in `.factory/claims.json` passed against
the supplied demo/test entry points.

| Claim | Result | Evidence exercised |
| --- | --- | --- |
| `one-click-owner-demo` | PASS | One click opened the seeded owner workspace and Reset restored it. |
| `demo-isolated` | PASS | Sample submission did not enter the authenticated inbox. |
| `owner-onboarding` | PASS | First owner, catalog naming, offer, link, and rename flow completed. |
| `entra-owner-auth` | PASS | Entra-only config/redirect passed; password header and password input were rejected/absent. |
| `private-prices` | PASS | Opaque 40-character link, expiry, and revocation states passed. |
| `request-inbox` | PASS | Submitted request appeared in the owner inbox. |
| `request-data-stored` | PASS | Every disclosed request field was present in API and SQLite evidence. |
| `owner-exports` | PASS | CSV and parsed PDF included the expected request and offer text. |
| `client-offer-visibility` | PASS | Separate links returned their assigned offer IDs. |
| `mixed-price-modes` | PASS | Fixed-price and needs-a-quote offers appeared in one request. |
| `offer-maintenance` | PASS | Edit, archive, restore, and delete controls worked. |
| `csv-offer-import` | PASS | Preview, duplicate skip, import, and undo worked. |
| `individual-request-privacy` | PASS | One request was exported/deleted while the other remained. |
| `deletion-audit-minimal` | PASS | Audit retained only request ID, action, and date. |
| `generated-art-disclosure` | PASS | Footer disclosure was visible. |
| `no-trackers` | PASS | Tested pages made only product-origin requests. |
| `no-checkout` | PASS | Demo submission created no payment, reservation, or third-party request. |
| `free-access` | PASS | Free-use fact and absence of checkout/subscription controls passed. |
| `online-required` | PASS | Fresh offline initial load failed as documented. |
| `operator-config` | PASS | Default port, data directory override, Entra overrides, and restart persistence passed. |

## Clean-checkout gates

| Check | Result |
| --- | --- |
| `npm ci` | PASS — 132 packages installed, 0 vulnerabilities. |
| `npm test` | PASS — 3/3. |
| `npm run check` | PASS — TypeScript and ESLint. |
| `npm run audit:copy` | PASS. |
| `npm run build` | PASS — production `dist/` produced. |
| `cargo fmt --manifest-path backend/Cargo.toml -- --check` | PASS. |
| `cargo test --locked --manifest-path backend/Cargo.toml` | PASS — 11/11, including 40 concurrent writes and rate limiting. |
| `cargo clippy --locked --manifest-path backend/Cargo.toml --all-targets -- -D warnings` | PASS. |
| `cargo build --release --locked --manifest-path backend/Cargo.toml` | PASS. |
| `npm run test:runtime` | PASS — restart persistence and runtime configuration. |
| `npm run test:e2e` | **FAIL — 21 passed, 1 performance check failed at 206 ms.** |

Docker and Podman are unavailable in this verifier container, so a local image
build was not possible. The exact Vite build and locked release Rust build did
pass, and the deployed health identity matches the candidate.

## Functional and backend evidence

- Live `/health` returned
  `{"build_sha":"f75e3f244969f3e6d49898b829b1c0343268cc0d","ok":true}`.
- The live HTML, main JS, CSS, and image hashes matched the local candidate
  build. `/`, `/demo`, `/owner`, `/privacy`, `/terms`, robots, and sitemap
  returned 200; a missing route returned the designed 404.
- The live demo submitted one fixed-price and one needs-a-quote offer with
  name, email, phone, PO reference, and note. Empty and malformed-email
  submissions showed the announced error, and correcting the fields produced
  request `DEMO-0424`. Reset returned the inbox to three records.
- Demo changes made only same-origin GET requests and left localStorage,
  sessionStorage, and IndexedDB empty.
- Unit/integration coverage accepted boundary name/note/item quantities,
  rejected over-limit and invalid values, proved recovery, saved 40 concurrent
  valid requests once each, and proved SQLite restart persistence.
- Live public throttling sent 120 simultaneous requests from one client: 44
  completed during token refill and 76 returned 429. Every 429 included
  `Retry-After: 1`. The configured allowance is 40 burst at 20 requests/second.
  The owner bucket allowed 8 and rejected the next 12 with the same header.
  `/health` remained available.
- `/api/auth/config` returned the Sociobot authority
  `https://sociobotcustomers.ciamlogin.com/35c6fe40-0ec0-46b6-98c6-213ad4de6650/`.
  The owner page has no password input, and its sign-in action contacted only
  that authority.

## Accessibility, privacy, headers, and performance

- The prescribed `/opt/fleet/lib/verify-url.sh` passed home, demo, owner,
  privacy, and terms: titles and `lang="en"`, one H1, a main landmark, alt
  text, named buttons, and zero console errors.
- Playwright Axe found zero violations on mobile landing, mobile demo, and dark
  mode, and zero serious/critical violations on every main route and the 404.
- At 390×844 there was no horizontal overflow or sub-44 px visible control.
  The first Tab revealed a 3 px clay focus ring, Enter moved through the skip
  link correctly, and keyboard Enter opened the sample demo. Route changes and
  Back restored H1 focus.
- Reduced motion computed all animation and transition durations as `1e-05s`.
- Browser request logs across the landing, demo flow, legal routes, and 404
  contained only the product origin. There were no console or page errors.
- Browser response headers showed `no-store` for HTML and one-year immutable
  caching for hashed JS/CSS/images. CSP is header-delivered and includes
  `frame-ancestors 'none'`; HSTS, `nosniff`, `DENY`, same-origin referrer
  policy, and restrictive permissions policy are present.
- Initial assets: 42.07 KB JS (12.96 KB gzip), 12.44 KB CSS (3.46 KB gzip), and
  9.50 KB mobile hero. The 269.75 KB auth chunk is lazy and absent on landing.
- Fresh mobile Lighthouse: Performance 100, Accessibility 100, Best Practices
  100, SEO 100; LCP 1,354 ms, CLS 0, TBT 0 ms, total transfer 86,210 bytes.

## Defects by severity

| Severity | Defects |
| --- | --- |
| Critical | None. |
| High | Required `npm run test:e2e` is reproducibly non-green on its mobile long-task budget. |
| Medium | README request-update claim is absent from `.factory/claims.json` and has no tagged claim test. |
| Low | None. |
| Informational | The researched subscription model is not implemented; the site honestly says it is free. Docker was unavailable to this verifier. |

## Required next steps

1. Make the mobile long-task gate deterministic and green without weakening the
   stated performance requirement; rerun the full suite repeatedly from a clean
   install.
2. Register and test request status updates, or remove “update” from README.
3. Re-run all 20 claim commands, the complete gate matrix, and live verification
   against the repaired commit.
