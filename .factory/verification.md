# Independent verification — FAIL

**Candidate:** `9baa52cd4c0198d02216cfaac35367d944e361b3`  
**Live URL:** `https://client-request-catalog.sociobot.in`  
**Verified:** 2026-08-30 (UTC)  
**Verdict:** **FAIL — do not release**

## Release blockers

1. **Critical — required claim contract is absent.** A clean clone at the
   candidate has no `.factory/claims.json`. Consequently there are no declared
   claim tests to run from the required demo entry point. This is explicitly a
   release-blocking condition.
2. **Critical — no one-click isolated demo exists.** The live first page has
   no `Try it with sample data` action. `/demo` returns the ordinary persisted
   `demo-client` catalog, without `Demo — sample data, nothing is saved`,
   Reset demo, Start for real, or a separate storage/tenant namespace. The
   source defaults every cold visit to `demo-client`; requests therefore go to
   the normal backend database rather than a sandbox.
3. **Critical — private pricing is publicly exposed.** A cold visit to `/`
   automatically loads the predictable `demo-client` token and displays fixed
   prices. This violates the brief constraint to prevent public exposure of
   private pricing. There is also no owner UI to create/revoke client links;
   the shipped product is limited to its seeded public link.
4. **High — concurrent valid submissions lose requests.** Against a fresh
   isolated SQLite instance, 40 simultaneous valid request submissions from
   different forwarded IPs yielded **32 × 200** and **8 × 500** (`Could not
   save the request.`). This is a real quote-request loss path, not a rate
   limit (each request used a distinct client IP).
5. **High — serious dark-mode accessibility defects.** Playwright axe on the
   live site with `prefers-color-scheme: dark` reports two serious
   `color-contrast` violations: `Start a request` is 1.98:1 and `Send request`
   is 1.71:1, each against the required 4.5:1 normal-text minimum.

## First-read result

Cold opening `/` presents a real client catalog for “Field & Form” and “Avery
at North Street”; a visitor can infer that they should select an offer then
use **Start a request**. It does not plainly introduce the product as a
private request catalog for small businesses, and it has no required one-click
sample demo. Therefore it fails the first-read/demo acceptance check.

## Local clean-checkout evidence

Clean checkout: `/tmp/client-request-catalog-qa.lpDKke` at the candidate SHA.

| Check | Result |
| --- | --- |
| `.factory/claims.json` and each listed demo claim test | **FAIL:** file missing |
| `npm ci` | Pass |
| `npm test` | Pass (1 test) |
| `cargo test --manifest-path backend/Cargo.toml` | Pass (3 tests) |
| `npm run build` | Pass; `dist/` produced; 14.11 KB JS / 7.98 KB CSS uncompressed |
| `npm run test:e2e` | Pass (2 tests) |
| lint/type check | No repository lint/typecheck is configured. `npx tsc --noEmit` exits 1 because no `tsconfig.json`/project is supplied. |
| exact Docker production build | Not run: this verifier environment has no `docker` executable. The Dockerfile also pins `rust:1.88-alpine`, contrary to the supplied `rust:1-slim`/un-pinned-minor build contract. |

Isolated backend exercise covered a valid submission (`CRC-0001`), invalid
token (410), blank name/invalid email/quantity zero/unknown product (400),
unauthenticated owner endpoint (401), authenticated overview, CSV export,
and PDF export. Boundary limits were additionally covered by the existing
backend tests. The local limiter test returned 41 × 200 and 59 × 429 for 100
concurrent catalog reads, with `Retry-After: 1`.

## Live deployment evidence

- `GET /health` returned 200 with
  `{"build_sha":"9baa52cd4c0198d02216cfaac35367d944e361b3","ok":true}`;
  the live deployment matches the candidate identity.
- Fresh desktop and 390 px Playwright loads had no console/page errors, no
  horizontal overflow, and loaded resources only from
  `client-request-catalog.sociobot.in` during the catalog flow. No trackers or
  third-party runtime resources were observed. This does **not** rescue the
  missing demo/privacy-claim test contract.
- Keyboard smoke: skip link, Enter activation for an offer, and form live
  error messaging work. Route navigation leaves focus on `body`, not the
  destination h1 as required.
- Light-mode Playwright axe found no serious/critical issue. Dark mode found
  the two serious contrast failures above. `npx @axe-core/cli` could not be
  run because its Selenium Chrome discovery did not find a system Chrome;
  the equivalent Playwright axe audit used the installed browser.
- Live request allowance is enforced: 500 simultaneous reads from one supplied
  client IP produced 104 × 200 and 396 × 429; rejected responses sent
  `Retry-After: 1`. The observed allowance is approximately 104 initial reads
  in that burst, rather than the documented 40-token burst, but the mandatory
  429 behavior is present.
- Response headers include `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: same-origin`, and `X-Frame-Options: DENY`; they omit CSP,
  HSTS, and cache-control. Hashed JS assets also have no cache-control.
- Required site metadata is incomplete: no meta description, canonical,
  Open Graph/Twitter metadata, or favicon. `/robots.txt`, `/sitemap.xml`, and
  `/404.html` all return the SPA HTML with 200 rather than their required
  content/404 behavior. Titles do not vary by route.

## Other defects

- **Medium:** Several header/footer links are 15–27 px tall at desktop and
  390 px, below the 44 px touch-target requirement.
- **Medium:** the promise “no trackers” and README privacy/runtime claims are
  unlisted claims because `claims.json` is absent.
- **Medium:** the researched brief calls for subscription monetization, while
  the product advertises a one-time $29 Plus unlock; the advertised Plus
  benefits (additional client links and branded receipts) are not implemented
  in the owner UI.
- **Medium:** GDPR-style individual export/deletion is not available to the
  client; the owner can only export/delete all stored request data.
- **Medium:** no cache policy, real 404, robots, sitemap, or full security
  header policy is shipped.

## Required repair and re-verification

Add a genuine isolated `/demo` and first-screen sample action; make private
links opaque and non-default; implement owner client-link lifecycle; add the
claims file plus one observable demo test per claim; make SQLite request
creation safe under concurrent writes/retry failures; fix dark colors and
touch/focus/navigation semantics; then add required metadata, headers,
cache/robots/sitemap/404, lint/typecheck, and re-run the exact container build.
