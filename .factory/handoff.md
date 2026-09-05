# Repair 9 handoff — Client Request Catalog

## Outcome

**PASS — all three strict review findings are resolved.**

The implementation commit is
`5f9b4bd1e3bcdf55ec16c60c80c97d764889a02e`. The documentation commit is the
later commit containing this handoff. The operator summary reports its exact
SHA. Report-only changes do not alter the deployed product image.

The deployed image is
`sociobotregistry.azurecr.io/sf-client-request-catalog:5f9b4bd1e3bc`.
Live `/health` reports the complete implementation SHA above.

## Current review findings

| Finding | Repair | Outcome proof |
| --- | --- | --- |
| F-3-1 | The tagged status test now selects `quoted`, `closed`, then `new`. | After every selection it checks the live announcement, status chip, owner API, and value after reload. |
| F-3-2 | The privacy test creates two requests with different names, emails, phones, references, notes, and offers. | The first CSV contains every first-request field and none of the second-request fields. Deletion still leaves the second request. |
| F-3-3 | The demo test edits an offer and adds a request before inspecting browser storage. | Local/session storage, IndexedDB, and Cache Storage stay empty. Reload restores three original offers and three original requests. The authenticated real inbox stays unchanged. |

The claim registry now describes those exact sandboxes. These are observable
browser and API assertions, not source-string checks.

## Earlier finding disposition

Every earlier review finding was rechecked through the current clean suite and
live product.

| Finding | Current disposition and evidence |
| --- | --- |
| F-1-1 | Fixed. One click opens the filled sample owner workspace and client view. |
| F-1-2 | Fixed. The client-link test advances beyond expiry and separately checks revocation. Both return 410. |
| F-1-3 | Fixed. Real and sample CSV/PDF exports contain known request details. Both PDFs parse. |
| F-1-4 | Fixed. Owners can edit, archive, restore, and delete offers. Referenced offers stay protected. |
| F-1-5 | Fixed. The claim starts at `/`, clicks once, and checks three offers, two links, and three requests. |
| F-1-6 | Fixed. One sample request contains fixed-price and needs-a-quote offers. |
| F-1-7 | Fixed. The broad configuration promise remains absent. Exact runtime behavior is registered. |
| F-1-8 | Fixed. A custom SQLite directory and restart persistence pass in `operator-config`. |
| F-1-9 | Fixed. The Entra defaults and all three environment overrides are tested. |
| F-1-10 | Fixed. The unverifiable deployment-topology promise remains absent from public copy. |
| F-1-11 | Fixed. Terms contain acceptable-use instructions, not an unregistered traffic promise. Live rate limiting is checked separately. |
| F-1-12 | Fixed. Tracking checks cover home, demo, owner, legal, 404, and private catalog routes. |
| F-1-13 | Fixed. Free use, connection need, and no tracking are above the phone fold. |
| F-1-14 | Fixed. CSV preview, validation, duplicate skipping, import, and undo pass. |
| F-1-15 | Fixed. The only displayed product name is Client Request Catalog. |
| F-1-16 | Fixed. Public copy uses “private client link,” then “client link.” |
| F-1-17 | Fixed. Public copy says “offers that need a quote.” |
| F-1-18 | Fixed. The section is named “Charges and availability.” |
| F-1-19 | Fixed. The demo action says “Set up your catalog.” |
| F-1-20 | Fixed. The generated copy audit finds no README sentence above 22 words. |
| F-1-21 | Fixed. README names the Sociobot Entra tenant without calling it safe. |
| F-1-22 | Fixed. Each route's `og:url` matches its canonical URL. |
| F-1-23 | Fixed. Private catalog titles are bounded and product-specific. |
| F-2-1 | Fixed. PDF.js parses real and sample PDFs and extracts known content. |
| F-2-2 | Fixed. The request claim reads the authenticated inbox and matches all submitted fields. |
| F-2-3 | Fixed. The no-checkout claim checks controls, traffic, offers, and request state. |
| F-2-4 | Fixed. Copy says owners review requests and contact clients outside the app. |
| F-2-5 | Fixed. Stored fields are checked in the API and SQLite. |
| F-2-6 | Fixed. Exports are buttons. The internal-link crawl finds no protected export link. |
| F-2-7 | Fixed. The runtime claim starts without `PORT` and reaches port 8080. |
| F-2-8 | Fixed. Public copy names the collected fields and uses “owner workspace.” |
| F-2-9 | Fixed. `/owner` is present in the sitemap. |
| F-2-10 | Fixed. The generated copy audit matches the current DOM, metadata, README, and catalog description. |

## Clean verification

A clean local clone of the implementation is at
`/tmp/crc-repair9-clean.A3tMbp/repo`. The first claim attempt happened before
dependencies were installed in that clone and returned `vite: not found`.
After the documented `npm ci` prerequisite, the entire claim run restarted
from claim one.

- All 21 exact commands in `.factory/claims.json` passed independently.
- `npm test`: 3/3 passed.
- `npm run check`: TypeScript and ESLint passed.
- `npm run audit:copy`: passed.
- `npm run build`: passed and produced `dist/`.
- `cargo fmt --manifest-path backend/Cargo.toml -- --check`: passed.
- `cargo test --locked --manifest-path backend/Cargo.toml`: 11/11 passed.
- `cargo clippy --locked --manifest-path backend/Cargo.toml --all-targets -- -D warnings`: passed.
- `cargo build --release --locked --manifest-path backend/Cargo.toml`: passed.
- `npm run test:runtime`: 1/1 passed.
- `npm run test:e2e`: 23/23 passed.

The browser suite covers normal, invalid, boundary, and recovery paths. It
also covers Entra-only ownership, SQLite persistence, 40 concurrent writes,
privacy, keyboard focus, mobile, offline recovery, metadata, links, 404, and
429 responses with `Retry-After`.

Production output remains within budget. Initial JavaScript is 42.54 KB raw
and 13.07 KB gzip. CSS is 12.52 KB raw and 3.48 KB gzip. The 67.60 KB gzip
authentication chunk remains lazy and does not load on the landing page.

## Deployment and live checks

Deployment used the existing factory configuration:

```text
WO_DATA_DIR=/data /opt/fleet/lib/deploy-container.sh \
  client-request-catalog /work/repo Dockerfile 8080
```

The fleet wrapper updated only `sf-client-request-catalog` and its matching
image. It preserved the product's Azure Files volume. The ready revision is
`sf-client-request-catalog--0000035`. Minimum and maximum replicas are both
one. `/data` is mounted from `sf-client-request-catalog-data`.

Live checks after deployment found:

- `/health` returns 200, `ok: true`, and the exact implementation SHA.
- `/`, `/demo`, `/owner`, `/privacy`, and `/terms` return 200.
- `/missing-page` deliberately returns 404 with the designed page.
- `robots.txt` and `sitemap.xml` return 200.
- The factory URL verifier passed all five real routes with no console errors.
- Every real route has `lang=en`, one H1, one main, named buttons, and complete image alternatives.
- Live Axe scans found zero serious or critical issues on every route and the 404.
- A 390×844 dark and reduced-motion scan found no overflow, small target, or meaningful motion.
- A fresh keyboard context reached the skip link first. Enter focused `main`.
- Route navigation, Back, and Forward restore H1 focus.
- The only console entry during the missing-page check was the expected HTTP 404 document message.
- A fresh offline context failed with `ERR_INTERNET_DISCONNECTED`, matching the stated connection requirement.

### Cold first screen

Fresh 1440×900 and 390×844 browsers opened the live page without scrolling.

- Job: “Create private catalogs for repeat clients.”
- Audience: small businesses sharing private prices and collecting contact details, selected offers, and notes.
- First action: “Try it with sample data.”

The free, connection, and tracking facts are above the phone fold.

### Live demo

One click opened `/?demo=1`. The persistent banner says “Demo — sample data,
nothing is saved.” The owner view contained three offers, two client links,
and three requests.

A sample request contained a fixed-price offer, a needs-a-quote offer, contact
details, a client reference, and a note. The sample PDF parsed as one page and
contained the expected request, client, and offer text. Reset returned the
inbox to three requests.

A separate live isolation pass edited an offer and added a fourth request.
Local storage, session storage, IndexedDB, and Cache Storage stayed empty.
Reload removed both changes and restored the three original offers and three
original requests. Every request was same-origin GET traffic. No API write was
made, so real data was unchanged.

### Live service allowance and performance

- Public burst: 41 normal 410 responses and 19 HTTP 429 responses.
- Owner burst: 8 route responses and 4 HTTP 429 responses.
- Every 429 sent `Retry-After: 1`.
- Twelve health requests remained 200.
- Lighthouse mobile: Performance 100, Accessibility 100, Best Practices 100, SEO 100.
- FCP 1.23 s, LCP 1.38 s, TBT 0 ms, CLS 0, total transfer 86,822 bytes.

The first Lighthouse attempt crashed its browser tab before auditing. A retry
with shared-memory use disabled completed with the scores above.

## Catalog description

`.factory/catalog-description.txt` is 88 characters plus its newline. It is
verb-first and was copied unchanged to
`/work/.evidence/catalog-description.txt`.

## Known gaps

- No release-blocking product or verification gap remains.
- `.factory/brief.json` is absent. This repair used the researched brief attached to the work order.
- The researched subscription remains unavailable because the product's Sociobot billing entry is not enabled. The product makes no paid claim and remains honestly free.
- No local container runtime was available. The successful fleet ACR build is the Dockerfile build proof.
