# Review 4 — Create private catalogs for repeat clients

## Verdict

**PASS — zero findings at every severity and zero untested claims.**

- Implementation reviewed: `5f9b4bd1e3bcdf55ec16c60c80c97d764889a02e`
- Prior documentation commit: `b03281128913991a9c0ec9fc00ae99daad516f42`
- Repository tip at review start: `a2696b34d901b98b4aa50fca9560794ae36a44cc`
- Live health build: `b67d2811de1662221ccb9934dd65f1bb4e689a1e`
- Live URL: https://client-request-catalog.sociobot.in
- Reviewed: 2026-09-05 UTC

The commits after `5f9b4bd` contain reports or Graphify output. The diff from
the implementation to the live health build changes only `graphify-out`.
The live runtime therefore matches the reviewed product implementation.

`.factory/brief.json` is absent. Scope was checked against the researched
brief in the work order, the repository contract, `.factory/design.md`, the
claim registry, prior reports, the live product, and the current source.

## First screen before scrolling

Fresh Chromium contexts opened the live home page at 1440×900 and 390×844.
No page was scrolled before these answers were recorded.

- Job: **Create private catalogs for repeat clients.**
- Audience: small businesses sharing private prices and collecting contact
  details, selected offers, and notes without checkout.
- First action: **Try it with sample data.** The next line says one click opens
  a filled owner workspace.

The same first screen shows **Free to use**, **Requires an internet
connection**, and **No analytics or tracking**. All three facts are above the
phone fold.

## Sample workspace and real-data isolation

One click opened `/?demo=1`. The first sample screen was already populated
with North Street Workshop data:

- three offers;
- two private client links;
- three requests in different states;
- a persistent **Demo — sample data, nothing is saved** label;
- **Reset demo** and **Set up your catalog** controls.

The live sample client view accepted one fixed-price offer and one offer that
needs a quote. A request with name, email, phone, client reference, note, and
quantities appeared as a fourth sample inbox row. Its receipt said nothing was
saved. Reset restored the original three requests.

The complete live sample flow made only same-origin GET requests. It made no
API write. Local storage, session storage, IndexedDB, and Cache Storage were
empty. Reload and reset restore the seed, and the tagged isolation test also
compares the authenticated real inbox. No real request data changed.

The sample PDF parsed as one page and contained the known request reference,
client, and offer. The sample CSV and every individual export are checked in
the browser suite.

## Claims gate

A clean clone at `a2696b3` was installed with `npm ci`. It was clean before
the run and remained free of tracked changes afterward. Every exact `test`
value in `.factory/claims.json` ran independently. All 21 commands passed.

| Claim | Result | Observable proof |
| --- | --- | --- |
| `one-click-owner-demo` | PASS | One click opens 3 offers, 2 links, and 3 requests; edit and reset work. |
| `demo-isolated` | PASS | Mutations leave all browser stores and the real inbox unchanged; reload restores the seed. |
| `owner-onboarding` | PASS | A first Entra owner names the workspace, adds an offer and link, and renames it. |
| `entra-owner-auth` | PASS | Required authority and client ID, redirect, no password field, and legacy-password rejection pass. |
| `private-prices` | PASS | A 40-character assigned link works; expiry and revocation separately return 410. |
| `request-inbox` | PASS | Submitted contact, offer, quantity, reference, and note match the authenticated inbox row. |
| `request-data-stored` | PASS | Every disclosed field is present in the API and SQLite row. |
| `request-status-updates` | PASS | `quoted`, `closed`, and `new` each update the announcement, chip, API, and reload state. |
| `owner-exports` | PASS | Real and sample CSV/PDF files contain known rows; both PDFs parse. |
| `client-offer-visibility` | PASS | Two private links return different assigned offer IDs. |
| `mixed-price-modes` | PASS | One request contains a fixed-price and needs-a-quote offer. |
| `offer-maintenance` | PASS | Edit, archive, restore, and delete complete in the sample workspace. |
| `csv-offer-import` | PASS | Preview, validation, duplicate skipping, import, and undo complete. |
| `individual-request-privacy` | PASS | One export contains only its client; deleting it leaves the other request. |
| `deletion-audit-minimal` | PASS | Deletion retains only request ID, action, and date. |
| `generated-art-disclosure` | PASS | The footer visibly names Azure AI Foundry generation. |
| `no-trackers` | PASS | Home, sample, owner, legal, 404, and private catalog routes stay on the product origin. |
| `no-checkout` | PASS | No payment control, third-party call, reservation, purchase, or offer mutation occurs. |
| `free-access` | PASS | The free fact is visible and no checkout or subscription control exists. |
| `online-required` | PASS | A fresh offline first load fails as stated. |
| `operator-config` | PASS | Default port 8080, data-directory override, Entra overrides, and restart persistence pass. |

The generated copy audit matches the current landing DOM, route metadata,
README, and catalog description. Manual comparison found no public claim
without a registry entry. There are **zero untested claims**.

## Product, backend, and recovery checks

The full 23-test browser suite covers the normal owner and client paths,
private offer assignments, offer lifecycle, imports, exports, request status,
privacy deletion, Entra sign-in, link expiry and revocation, navigation,
keyboard use, metadata, offline behavior, and rate limiting.

A separate fresh SQLite workspace checked exact request boundaries:

- normal request: 200;
- empty name, invalid email, no items, quantity 0, quantity 101, and an
  unassigned offer: 400;
- accepted edge: 120-character name, 2,000-character note, 30 items, and
  quantity 100: 200;
- rejected edge: 121-character name, 2,001-character note, and 31 items: 400;
- a valid request immediately after the invalid cases: 200.

The owner inbox contained exactly the three accepted requests. SIGTERM logged
`shutdown received`. The runtime claim restarts the server against the same
SQLite directory and proves that the business and offer remain. Rust tests
also prove 40 concurrent requests persist once each and that two client links
cannot read or submit each other's assigned offers.

The live `/health` endpoint returned 200 and `ok:true`. A harmless burst of 80
unknown-route requests from one forwarded client identity returned 41 expected
404 responses and 39 HTTP 429 responses. Every 429 carried `Retry-After: 1`.
Health remained 200. The deliberate 404 responses are expected behavior, not
defects.

## Browser, accessibility, privacy, and site structure

- `/`, `/demo`, `/owner`, `/privacy`, and `/terms` return 200. The designed
  unknown route returns HTTP 404 with a way home.
- Each route has its own title, canonical URL, matching Open Graph URL, one H1,
  one main landmark, `lang="en"`, labeled controls, and complete image text.
- `robots.txt`, `sitemap.xml`, the favicon, touch icon, and social image work.
- Every visible internal link returns 200. Exports are buttons, not crawlable
  protected links.
- Fresh 390×844 light and dark scans of every route and the 404 found zero
  serious or critical Axe issues, no horizontal overflow, no control below
  44×44 px, and no unexpected console or page error.
- The first Tab reveals the skip link. Enter moves focus to `main`. Route
  changes, Back, and Forward focus and announce the new H1. There is no trap.
- Reduced-motion mode leaves no animation or transition longer than 0.01 ms.
- Security headers include CSP with header-delivered `frame-ancestors`, HSTS,
  `nosniff`, same-origin referrer policy, frame denial, and a restricted
  permissions policy.
- Product pages load no analytics, advertising, remote fonts, or tracking
  script. The only external origin allowed for sign-in is the required
  Sociobot Microsoft Entra tenant.
- The product does not promise offline reload or update installation. Its
  stated online requirement and loaded-sample offline recovery both pass.

The trade-print palette, halftone texture, generated request-slip image,
stamped controls, and square rules match `.factory/design.md`. The illustration
has recorded provenance and a visible footer disclosure.

## Quality and performance gates

| Gate | Result |
| --- | --- |
| `npm ci` | PASS; 132 packages, 0 audit vulnerabilities |
| `npm test` | PASS; 3/3 |
| `npm run check` | PASS; TypeScript and ESLint |
| `npm run audit:copy` | PASS |
| `npm run build` | PASS; `dist/` produced |
| `cargo fmt --manifest-path backend/Cargo.toml -- --check` | PASS |
| `cargo test --locked --manifest-path backend/Cargo.toml` | PASS; 11/11 |
| `cargo clippy --locked --manifest-path backend/Cargo.toml --all-targets -- -D warnings` | PASS |
| `cargo build --release --locked --manifest-path backend/Cargo.toml` | PASS |
| `npm run test:runtime` | PASS; 1/1 |
| `npm run test:e2e` | PASS; 23/23 |

Production output is 42.54 KB raw / 13.07 KB gzip initial JavaScript and
12.52 KB raw / 3.48 KB gzip CSS. The 67.60 KB gzip Entra authentication chunk
is lazy and does not load on the landing page.

Fresh Lighthouse mobile results are Performance 100, Accessibility 100, Best
Practices 100, and SEO 100. LCP was 1.38 seconds, CLS 0, and TBT 0 ms.

## Earlier review findings

Every earlier review finding, including every minor item, was checked against
the current claim tests, complete suite, copy audit, and live product.

| Finding | Current disposition |
| --- | --- |
| F-1-1 | Fixed: the one-click sample is a filled owner workspace with a client view. |
| F-1-2 | Fixed: expiry and revocation are separately exercised and return 410. |
| F-1-3 | Fixed: known rows are asserted in CSV and parsed real/sample PDFs. |
| F-1-4 | Fixed: offer edit, archive, restore, and delete all pass. |
| F-1-5 | Fixed: the registered test starts at `/` and checks all seed counts. |
| F-1-6 | Fixed: mixed fixed-price and needs-a-quote items are registered and tested. |
| F-1-7 | Fixed: the broad no-configuration statement is absent; exact runtime behavior is registered. |
| F-1-8 | Fixed: custom SQLite location and restart persistence are tested. |
| F-1-9 | Fixed: Entra defaults and all three environment overrides are tested. |
| F-1-10 | Fixed: the unverifiable deployment-topology claim remains absent. |
| F-1-11 | Fixed: Terms gives acceptable-use guidance; deployed rate limiting is separately proved. |
| F-1-12 | Fixed: privacy request logging covers every named route and owner/private states. |
| F-1-13 | Fixed: free, connection, and tracking facts are above the phone fold. |
| F-1-14 | Fixed: CSV preview, validation, duplicate skip, import, and undo pass. |
| F-1-15 | Fixed: the displayed product name is consistent. |
| F-1-16 | Fixed: access wording consistently uses private client link/client link. |
| F-1-17 | Fixed: unexplained quote-first wording is gone. |
| F-1-18 | Fixed: the section is plainly titled Charges and availability. |
| F-1-19 | Fixed: the action is named Set up your catalog. |
| F-1-20 | Fixed: the copy audit finds no sentence above 22 words. |
| F-1-21 | Fixed: vague safe-default wording is gone. |
| F-1-22 | Fixed: each route's Open Graph URL matches its canonical URL. |
| F-1-23 | Fixed: private-catalog titles are bounded and product-specific. |
| F-2-1 | Fixed: the sample PDF parses and contains the known reference, client, and offer. |
| F-2-2 | Fixed: the inbox claim reads and matches the authenticated owner inbox. |
| F-2-3 | Fixed: no-checkout proof covers controls, traffic, state, and mutations. |
| F-2-4 | Fixed: copy says owners contact clients outside the app. |
| F-2-5 | Fixed: stored fields are registered and checked in API and SQLite. |
| F-2-6 | Fixed: exports are buttons; the link crawl has no protected export URL. |
| F-2-7 | Fixed: the runtime claim starts without `PORT` and reaches 8080. |
| F-2-8 | Fixed: vague copy was replaced with the exact collected fields. |
| F-2-9 | Fixed: the sitemap contains `/owner`. |
| F-2-10 | Fixed: the generated audit matches current product and README copy. |
| F-3-1 | Fixed: `quoted`, `closed`, and `new` each have full UI/API/reload proof. |
| F-3-2 | Fixed: individual export includes one client and excludes every field from the other. |
| F-3-3 | Fixed: the tagged test checks every browser store and seed restoration after reload. |

## Earlier verification findings

| Earlier report | Current disposition and proof |
| --- | --- |
| Verification 1 | Claims, isolated demo, private links, concurrency, dark contrast, touch targets, privacy controls, headers, metadata, and 404 behavior all pass now. |
| Verification 2 | Client-specific offer assignment and individual request export/deletion pass. |
| Verification 3 | Real Entra onboarding, minimal deletion audit, stricter owner/write limits, phone facts, and strict Clippy pass. The absent subscription is honestly disclosed as free use. |
| Verification 4 | Required Entra tenant, 44 px owner terms target, and Lighthouse threshold pass. |
| Verification 5 | The false paid checkout was removed, SIGTERM is graceful, and generated-art disclosure is visible. |
| Verification 6 | Back/Forward restore H1 focus. The current live SHA differs only by Graphify files, which the work order allows. |
| Verifications 7 and 8 | Both passed with no product finding; their green paths remain covered. |
| Verification 9 | The former mobile timing test is stable in the 23/23 full run, and request status updates now have a registered complete claim. |
| Verifications 10 and 11 | Both passed. This review independently repeated their claim, browser, backend, and live checks. |

## Missed leverage and known gap

No missing AI feature is justified. The work is structured data entry and
review; CSV import plus CSV/PDF export provides the useful data bridge without
adding cost or privacy risk.

The researched subscription is not offered because the owned Sociobot billing
product is not enabled. The current product makes no paid claim, provides the
complete core workflow for free, and does not expose a broken checkout. This
is an honest business follow-up, not a product defect.

## Findings

| Severity | Count |
| --- | ---: |
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low | 0 |
| Untested claims | 0 |

**Final verdict: PASS.**
