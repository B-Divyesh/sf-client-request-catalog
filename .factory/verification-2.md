# Independent verification 2 — FAIL

**Candidate:** `eee5eec1a1688ceaef0ac9e4865340709449d394`  
**Live URL:** `https://client-request-catalog.sociobot.in`  
**Verified:** 2026-09-01 UTC  
**Verdict:** **FAIL — do not release**

## Release-blocking findings

1. **High — catalog visibility is not client-specific.** The researched brief
   requires client-specific visibility. In a fresh, isolated local server, I
   created `Client Alpha` and `Client Beta` with separate opaque links. Both
   links returned the same three offers: Quarterly maintenance visit,
   Replacement fitting set, and Repeat consumables pack. There is no owner
   control or stored relationship for assigning an offer to one client rather
   than another. A business therefore cannot safely offer a client-specific
   priced item without every active client link seeing it.
2. **High — GDPR-style individual export and deletion are unavailable.** The
   privacy page tells a requester to ask the business for export/deletion, but
   the owner workspace only exports the complete inbox and only deletes all
   request/contact data. In the isolated server check, both
   `DELETE /api/admin/requests/1` and `GET /api/admin/requests/1.csv` returned
   `405`. Exporting the whole inbox for one person's request can disclose
   other clients' information; deleting the whole inbox is not a usable
   individual deletion path.

These gaps miss explicit brief constraints, so the candidate cannot be
accepted despite the otherwise clean technical checks.

## First-read and live deployment

A cold visit clearly says: “Create private catalogs for repeat clients.” The
next sentence identifies small businesses, and the visible **Try it with
sample data** action says it shows a filled catalog in one click. The first
screen therefore answers what it does, for whom, and what to do first.

The live `/health` response was 200 with:

```json
{"build_sha":"eee5eec1a1688ceaef0ac9e4865340709449d394","ok":true}
```

The deployment matches the candidate. The demo produced `DEMO-0421` and the
message “Nothing was saved”; it has the required persistent demo banner,
Reset demo, and Start for real controls.

## Claims and local quality gates

Fresh checkout: `/tmp/client-request-catalog-verify-RXNxR2` at the candidate
SHA. A separate fresh `npm ci` check also installed `vite` successfully.

| Check | Result |
| --- | --- |
| `@claim:demo-isolated` | Pass |
| `@claim:private-prices` | Pass |
| `@claim:request-inbox` | Pass |
| `@claim:owner-exports` | Pass |
| `@claim:no-trackers` | Pass |
| `@claim:no-checkout` | Pass |
| `npm test` | Pass: 1 test |
| `npm run check` | Pass: TypeScript and ESLint |
| `cargo fmt --manifest-path backend/Cargo.toml -- --check` | Pass |
| `cargo test --manifest-path backend/Cargo.toml` | Pass: 6 tests, including 40 concurrent writes |
| `npm run build` | Pass: `dist/`; JS 21.07 KB (7.10 KB gzip), CSS 10.22 KB (2.97 KB gzip) |
| `npm run test:e2e` | Pass: 11 Chromium tests |

The available Docker/Podman executables are absent in this verifier image, so
an exact local container build could not be run. The Dockerfile was inspected:
it is multi-stage, non-root, accepts `BUILD_SHA`, and uses `rust:1-slim`.

## Live browser, privacy, and service checks

- Desktop and 390 px mobile: no horizontal overflow; all measured links,
  buttons, and form controls were at least 44 px in both tested views.
- Keyboard: the first Tab reaches the visible skip link; Enter moves focus to
  `main`. The demo form works using its controls and reports its result.
- Light and dark Playwright axe checks across `/`, `/demo`, `/privacy`, and
  `/terms`: no serious or critical findings. No console errors or page errors
  were observed.
- Reduced-motion browser context completed without errors. Every checked page
  has `lang=en`, one h1, one main landmark, and image alt text.
- Outgoing browser request logs for landing, demo, and the submission flow
  contained only `https://client-request-catalog.sociobot.in`; no analytics,
  remote fonts, or third-party scripts were observed.
- Headers include CSP with `frame-ancestors 'none'`, HSTS, nosniff,
  Referrer-Policy, Permissions-Policy, and `no-store` HTML caching. Hashed JS
  uses `public, max-age=31536000, immutable`. `/robots.txt` and `/sitemap.xml`
  return 200; an unknown route returns 404.
- Rate-limit allowance check: 70 concurrent `/api/demo/catalog` requests from
  one client identifier produced 42 × 200 and 28 × 429. Every sampled 429 had
  `Retry-After: 1`. This confirms the documented 40-token burst plus refill
  behavior is enforced.
- Mobile Lighthouse: Performance 98, Accessibility 100, Best Practices 100,
  SEO 100; LCP 1.752 s, CLS 0, TBT 149 ms, transfer 168,750 bytes.

## Required follow-up

Implement per-client offer assignment and expose it in the owner workspace,
then add individual request export and deletion controls that operate only on
the selected request. Add observable claim coverage for both privacy-boundary
behaviours and repeat independent verification.
