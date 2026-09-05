# Independent verification 11 — PASS

**Verdict: PASS.** There are **zero findings** at every severity and **zero untested claims**.

- Reviewed implementation: `5f9b4bd1e3bcdf55ec16c60c80c97d764889a02e`
- Documentation commit: `fb8823711593d341d30b5452973a3ddc3bfa9a02e`
- Live URL: https://client-request-catalog.sociobot.in
- Verified: 2026-09-05 UTC

## First screen

Fresh desktop (1440×900) and phone (390×844) browser contexts loaded the live
home page without scrolling.

- Job: **Create private catalogs for repeat clients.**
- Audience: small businesses that share private prices and collect contact
  details, selected offers, and notes without checkout.
- First action: **Try it with sample data.** Its adjacent text says that one
  click opens a filled owner workspace.

The three visible facts are “Free to use,” “Requires an internet connection,”
and “No analytics or tracking.” The phone view had no horizontal overflow or
interactive target below 44 CSS pixels.

## Demo and product paths

One click reached `/?demo=1`. The populated North Street Workshop sample
showed three offers, two private client links, and three requests. The
persistent **“Demo — sample data, nothing is saved”** label, **Reset demo**, and
**Set up your catalog** were visible.

I changed a sample offer, confirmed that change, then used Reset demo. The
original offer returned. Local storage, session storage, IndexedDB, and Cache
Storage were all empty. The demo made no non-GET request, so this pass could
not write real request data. The independent `demo-isolated` claim test also
compares the authenticated real inbox before and after a demo submission.

Normal, invalid, boundary, and recovery behavior is covered by the clean
browser and runtime suites: required request fields, invalid values, quote and
fixed-price offers, client-link expiry/revocation, status changes, CSV/PDF
exports, deletion isolation and audit minimization, configuration overrides,
SQLite restart persistence, and concurrent writes.

## Claims gate

A fresh detached checkout of the reviewed implementation was prepared at
`/tmp/client-request-catalog-verify11.EWTFRQ/repo`. The first attempted claim
command correctly failed before dependencies were installed there
(`vite: not found`). After the documented `npm ci` prerequisite, the sweep
was restarted at claim one. All 21 exact commands in
`.factory/claims.json` passed independently; no result is omitted.

| Claims | Result |
| --- | --- |
| one-click-owner-demo; demo-isolated; owner-onboarding; entra-owner-auth | PASS |
| private-prices; request-inbox; request-data-stored; request-status-updates | PASS |
| owner-exports; client-offer-visibility; mixed-price-modes; offer-maintenance | PASS |
| csv-offer-import; individual-request-privacy; deletion-audit-minimal | PASS |
| generated-art-disclosure; no-trackers; no-checkout; free-access | PASS |
| online-required; operator-config | PASS |

The three formerly incomplete proofs are now complete: status transitions
exercise quoted, closed, and new with reload persistence; individual export
asserts that every second client field is absent; and the demo mutation asserts
empty browser stores plus reset/reload behavior.

## Clean quality gate

The following all passed in that fresh checkout:

| Command | Result |
| --- | --- |
| `npm test` | 3/3 passed |
| `npm run check` | TypeScript and ESLint passed |
| `npm run audit:copy` | passed |
| `npm run build` | passed and produced `dist/` |
| `cargo fmt --manifest-path backend/Cargo.toml -- --check` | passed |
| `cargo test --locked --manifest-path backend/Cargo.toml` | 11/11 passed |
| `cargo clippy --locked --manifest-path backend/Cargo.toml --all-targets -- -D warnings` | passed |
| `cargo build --release --locked --manifest-path backend/Cargo.toml` | passed |
| `npm run test:runtime` | 1/1 passed |
| `npm run test:e2e` | 23/23 passed |

The full suite result was `{"status":"passed","failedTests":[]}`. Build
output measured 42.54 KB JavaScript (13.07 KB gzip) and 12.52 KB CSS
(3.48 KB gzip) on the landing route.

## Live checks

- `/health` returned 200 and `ok: true`.
- `/`, `/demo`, `/owner`, `/privacy`, `/terms`, `robots.txt`, and
  `sitemap.xml` returned 200 after the rate-limit recovery interval.
- A missing route returned the designed 404 page with HTTP 404. Its expected
  failed-document console message is not a defect.
- The factory URL verifier passed: title, language, main landmark, one H1,
  complete image alternatives, named buttons, and no console errors.
- Axe found zero serious or critical violations on home, demo, owner, privacy,
  terms, and the designed 404 at a phone viewport. Every route has its own
  title, one H1, and one main landmark.
- Keyboard testing reached Skip to main content first; Enter focused
  `#main`. Privacy navigation and Back focused the new route H1.
- A fresh offline context failed with `ERR_INTERNET_DISCONNECTED`, matching
  the explicit “requires an internet connection” claim.
- Browser request logs stayed on the product origin; no analytics, advertising,
  remote-font, tracker, checkout, or third-party request was observed.
- An 80-request live burst to a harmless missing route produced 42 deliberate
  404s and 38 HTTP 429s. Every 429 carried `Retry-After: 1`.
- Mobile Lighthouse: Performance 100, Accessibility 100, Best Practices 100,
  SEO 100; FCP 1.2 s, LCP 1.4 s, CLS 0.

## Identity and earlier findings

Live `/health` reported
`b67d2811de1662221ccb9934dd65f1bb4e689a1e`, a later commit whose diff from
the reviewed implementation contains only `graphify-out` metadata. It does
not change the product runtime. Per the work order, this Graphify-only tip
does not require a new product image; the implementation reviewed is
`5f9b4bd…`, and the documentation commit is `fb88237…`.

All earlier findings were inspected. F-1-1 through F-1-23 remain resolved by
the current claim suite, copy audit, live phone first-read, metadata/routing,
and demo checks. F-2-1 through F-2-10 remain resolved by parsed valid
CSV/PDF export tests, authenticated inbox assertions, no-checkout checks,
registered privacy/runtime claims, link structure, sitemap, and the generated
copy audit. F-3-1 through F-3-3 are resolved by the strengthened tagged
tests described above. The former verification-9 high mobile-test failure and
medium unregistered status-update claim are resolved: the full suite is green
and `request-status-updates` is registered and tested. The only historic
informational notes remain honest product facts: Docker/Podman are unavailable
in this verifier container, and the product is free because no billing entry
is available. Neither is a product defect.

## Findings

| Severity | Count |
| --- | ---: |
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low | 0 |
| Informational | 0 |

**Final verdict: PASS.**
