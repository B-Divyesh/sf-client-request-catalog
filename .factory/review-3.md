# Adversarial first-read review 3

Reviewed 2026-09-02 against
`https://client-request-catalog.sociobot.in`, repository base
`83ee2d6574ca515a9789c5c4bfacc9ebf3a1303d`, and deployed build
`c8aff8d0ff0da15271acd4462738224748bd4e52` reported by `/health`.
`.factory/brief.json` is absent, so scope was checked against the product
contract, design thesis, README, claims registry, live UI, and implementation.

## Verdict

**FAIL — 3 blocking findings.**

The product itself is clear and usable in a cold phone visit. The live demo is
filled, isolated, resettable, and honest. All 21 registered claim commands and
the complete quality suite exit successfully from a clean clone. Three green
claim tests do not prove their full registered statements, however. A PASS
requires zero findings and no untested claim.

## Cold first screen

Fresh Chromium contexts with no cookies or stored data opened `/` at 390 × 844
and 1440 × 900. Nothing was scrolled before these answers were recorded.

- What it does: gives a business a private price catalog and collects client
  contact details, selected offers, and notes without checkout.
- For whom: small businesses serving repeat clients.
- First click: **Try it with sample data**.

All three answers are above the fold at both sizes. The exact supporting text
is “Create private catalogs for repeat clients,” “Small businesses share
private prices and collect contact details, selected offers, and notes without
checkout,” and “Try it with sample data.” The adjacent text says “One click
opens a filled owner workspace.” The free, connection, and tracking facts are
also above the fold at 390 px. This check passes.

## Findings

### Blocking

#### F-3-1 — The request-status test proves only `quoted`

- Location/quote: `.factory/claims.json`, `request-status-updates`: “Owners can
  change each request status to new, quoted, or closed.” In
  `e2e/catalog.spec.ts:699`, the tagged test observes the initial `new` value,
  selects `quoted`, reloads, and checks that `quoted` persisted.
- Why this fails: the test never selects `closed` and never changes a request
  back to `new`. The control or backend could reject either promised value
  while the exact registered command remains green. This leaves part of a
  listed claim untested.
- Concrete fix: in `@claim:request-status-updates`, select `quoted`, `closed`,
  and `new` in sequence. After each change, assert the live message, status
  chip, owner API value, and value after reload.

#### F-3-2 — The individual-export privacy test never excludes the other client

- Location/quote: `.factory/claims.json`, `individual-request-privacy`:
  “Owners can export or delete one request without exposing other clients’
  details.” In `e2e/catalog.spec.ts:783`, the test creates
  `first@example.test` and `second@example.test`, then checks only that the
  first export contains `first@example.test`.
- Why this fails: there is no assertion that the first export omits
  `second@example.test` or the second request's other identifying fields. An
  endpoint that exports both clients would pass. The later assertion that the
  second row remains after deleting the first proves deletion isolation, not
  export privacy.
- Concrete fix: give both requests distinct names, emails, phone numbers,
  references, notes, and offers. Assert that the first individual export
  contains every first-request field and contains none of the second-request
  fields. Keep the existing deletion and audit assertions.

#### F-3-3 — The memory-only demo claim is not tested for browser persistence

- Location/quote: README and `.factory/claims.json`, `demo-isolated`: “Demo
  changes stay in browser memory and never enter the real request inbox.” The
  exact tagged test at `e2e/catalog.spec.ts:458` checks that no demo/catalog API
  path is called and that the real inbox count is unchanged.
- Why this fails: the test never inspects `localStorage`, `sessionStorage`,
  IndexedDB, Cache Storage, or behavior after reload. A demo that writes its
  edits to persistent browser storage would still pass the registered command,
  contrary to “stay in browser memory.” Manual live inspection found those
  stores empty, but the claim contract requires this proof in its tagged test.
- Concrete fix: mutate an offer and add a sample request, assert all persistent
  browser stores remain empty, reload, and assert the original three offers
  and three requests return. Keep the authenticated real-inbox comparison.

## Copy audit

Counts use the repository audit's token rule: hyphenated terms count once, and
path/version components count separately. Repeated navigation/footer labels
are grouped. No item exceeds 22 words, uses a banned marketing term, changes an
established term, or presents a non-result-naming button. No copy finding was
found.

### Landing page

| Copy | Words | Flag |
| --- | ---: | --- |
| CLIENT REQUEST CATALOG | 3 | — |
| Demo | 1 | — |
| Owner workspace | 2 | — |
| Privacy | 1 | — |
| Create private catalogs for repeat clients | 6 | — |
| Small businesses share private prices and collect contact details, selected offers, and notes without checkout. | 15 | — |
| Try it with sample data | 5 | — |
| One click opens a filled owner workspace. | 7 | — |
| Set up your catalog | 4 | — |
| Free to use. | 3 | — |
| Requires an internet connection. | 4 | — |
| No analytics or tracking. | 4 | — |
| Client view | 2 | — |
| Show only the offers a client needs | 7 | — |
| One catalog can show fixed prices and offers that need a quote. | 12 | — |
| Maintenance visit | 2 | — |
| Fixed price | 2 | — |
| Replacement fitting set | 3 | — |
| Price on application | 3 | — |
| Repeat supplies | 2 | — |
| Previous order | 2 | — |
| How it works | 3 | — |
| From private client link to request inbox | 7 | — |
| Set your business name. | 4 | — |
| Create the owner workspace with Microsoft sign-in. | 7 | — |
| Share the catalog. | 3 | — |
| Only people with that private client link can view its prices. | 11 | — |
| Review requests in the inbox. | 5 | — |
| Contact the client by email outside this app. | 8 | — |
| Charges and availability | 3 | — |
| This is not a checkout | 5 | — |
| It does not charge clients, reserve stock, or create a purchase. | 11 | — |
| The business contacts each client outside this app. | 8 | — |
| Private request catalogs for small businesses · Version 1.4 | 9 | — |
| Original illustration generated with Azure AI Foundry. | 7 | — |
| Terms | 1 | — |
| A blank request slip beside a ruler and spool in two-colour print. | 12 | — |

### Landing metadata and catalog description

| Copy | Words | Flag |
| --- | ---: | --- |
| Client Request Catalog — share private prices | 6 | — |
| Create private client catalogs and collect contact details, selected offers, and notes in one owner inbox. | 16 | — |
| Create private client catalogs that collect contact details, selected offers, and notes. | 12 | — |

### README

| Copy | Words | Flag |
| --- | ---: | --- |
| Client Request Catalog | 3 | — |
| Client Request Catalog helps small businesses share private prices and collect requests without checkout. | 14 | — |
| Open `/?demo=1` to try a sample owner workspace. | 9 | — |
| It starts with three offers, two private client links, and three requests. | 12 | — |
| Demo changes stay in browser memory and never enter the real inbox. | 12 | F-3-3: claim proof incomplete |
| Open `/owner` to create the first owner workspace. | 8 | — |
| Sociobot Microsoft Entra External ID is the only owner sign-in method. | 11 | — |
| Owners can name the catalog, maintain offers, import CSV price sheets, and issue client links. | 15 | — |
| They can change each request status, export it, or delete it. | 11 | F-3-1: claim proof incomplete |
| The product is free to use and requires an internet connection to load. | 13 | — |
| One catalog can contain fixed prices and offers that need a quote. | 12 | — |
| Run | 1 | — |
| `PORT` defaults to `8080`. | 4 | — |
| Set `DATA_DIR` when local data should live somewhere other than `/data`. | 12 | — |
| Mount `/data` on durable storage when deploying. | 7 | — |
| The default sign-in configuration points to Sociobot’s Entra tenant. | 9 | — |
| Operators may set `ENTRA_TENANT_ID`, `ENTRA_TENANT_SUBDOMAIN`, and `ENTRA_CLIENT_ID` for another tenant. | 16 | — |
| Deploy | 1 | — |
| Build the root Dockerfile and mount durable storage at `/data`: | 10 | — |
| Verify | 1 | — |
| Every visitor-facing claim is registered in `.factory/claims.json`. | 9 | — |
| The browser suite covers every registered claim. | 7 | F-3-1–F-3-3: inaccurate until assertions are complete |
| It also checks accessibility, routing, metadata, image delivery, offline behavior, and rate limits. | 13 | — |
| Privacy | 1 | — |
| No product page loads analytics, advertising, remote fonts, or tracking scripts. | 11 | — |
| Real requests store the submitted name, email, phone, reference, note, and selected offers. | 13 | — |
| Owners can export request rows as CSV or PDF. | 9 | — |
| They can delete one request without exposing other clients. | 9 | F-3-2: claim proof incomplete |
| Deletion keeps only an internal request ID, action, and date. | 10 | — |
| Sending a request does not charge the client, reserve stock, or create a purchase. | 14 | — |
| The footer discloses the original image generation with Azure AI Foundry. | 11 | — |

Terminology is consistent: **private client link** then **client link**;
**owner workspace**; **offer**; **request**; and **request inbox**. The landing
buttons name results: **Try it with sample data** and **Set up your catalog**.

## Demo and sandbox evidence

- `/` reaches `/?demo=1` in one click on phone and desktop.
- The first resulting screen is the North Street Workshop owner workspace with
  three realistic offers, two private client links, and three requests.
- The persistent banner says “Demo — sample data, nothing is saved” and shows
  **Reset demo** and **Set up your catalog**.
- Editing the first offer, submitting a sample request, and returning to the
  owner view raised the sample request count from three to four. The receipt
  said “Sample request DEMO-0424 added to the sample inbox. Nothing was saved.”
- **Reset demo** restored “Quarterly maintenance visit” and three requests.
- The live demo flow made only GET requests to the product origin. It made no
  API write, and localStorage, sessionStorage, and IndexedDB were empty.
- The demo PDF opened as one page. The clean claim suite extracted its known
  reference, client, and offer text.
- A fresh offline context could not load the product, matching the stated
  connection requirement. The seeded demo can still complete an in-memory
  request after it has loaded, as the full suite verifies.

The live behavior passes the sandbox check. F-3-3 concerns required automated
proof of the stronger memory-only sentence.

## Claims audit

Every exact `test` value in `.factory/claims.json` was run independently after
`npm ci` in clean clone `/tmp/crc-review3-clean.x7aFRy/repo`.

| Claim | Result and evidence assessment |
| --- | --- |
| `one-click-owner-demo` | PASS; one click, seeded counts, edit, and reset asserted. |
| `demo-isolated` | PASS command; real inbox and network isolation asserted, browser persistence omitted (F-3-3). |
| `owner-onboarding` | PASS; setup, catalog name, offer, link, and rename asserted. |
| `entra-owner-auth` | PASS; authority, client ID, redirect, legacy-header rejection, and no password field asserted. |
| `private-prices` | PASS; 40-character token, assigned prices, expiry, revocation, and both 410 states asserted. |
| `request-inbox` | PASS; browser submission is matched in the authenticated inbox. |
| `request-data-stored` | PASS; every disclosed field and selected-offer row is read from the API and SQLite. |
| `request-status-updates` | PASS command; only `quoted` transition asserted (F-3-1). |
| `owner-exports` | PASS; real and demo CSV/PDF contents asserted with PDF parsing. |
| `client-offer-visibility` | PASS; two assignments return distinct offer IDs. |
| `mixed-price-modes` | PASS; fixed and needs-a-quote offers appear in one sample request. |
| `offer-maintenance` | PASS; edit, archive, restore, and delete complete in the isolated owner demo. |
| `csv-offer-import` | PASS; preview, duplicate skip, import, and undo asserted. |
| `individual-request-privacy` | PASS command; deletion isolation asserted, export exclusion omitted (F-3-2). |
| `deletion-audit-minimal` | PASS; only request ID, action, and date remain. |
| `generated-art-disclosure` | PASS; visible footer disclosure asserted. |
| `no-trackers` | PASS; landing, demo, legal, 404, private catalog, and owner routes stay same-origin. |
| `no-checkout` | PASS; no payment action/request, reservation, purchase, or offer mutation is observed. |
| `free-access` | PASS; free fact and absence of subscription/checkout controls asserted. |
| `online-required` | PASS; a fresh offline context cannot load the product. |
| `operator-config` | PASS; default port, custom data directory, restart persistence, and all Entra overrides asserted. |

No claim-like product sentence was found without a corresponding claims entry.
The three findings are incomplete proof inside listed entries, not missing
registry rows.

## Earlier-finding verification

Every finding in `.factory/review-1.md` and `.factory/review-2.md`, every repair
in `.factory/polish-1.md` and `.factory/polish-2.md`, and the prior handoff were
checked against live behavior and current code. No earlier finding is reopened.

| Earlier finding | Independent round-3 result |
| --- | --- |
| F-1-1 | Fixed: one-click demo opens the filled owner workspace and client view. |
| F-1-2 | Fixed: expired access is advanced and asserted as 410. |
| F-1-3 | Fixed: known request content is asserted in parsed real/demo PDFs and CSV. |
| F-1-4 | Fixed: edit, archive, restore, and delete exist in UI, API, and tests. |
| F-1-5 | Fixed: the registered test starts at `/`, clicks once, and checks seeded counts. |
| F-1-6 | Fixed: one request contains both price modes. |
| F-1-7 | Fixed: the unqualified no-environment promise remains absent. |
| F-1-8 | Fixed: custom SQLite location and restart persistence are tested. |
| F-1-9 | Fixed: Entra defaults and all three overrides are tested. |
| F-1-10 | Fixed: the unverifiable replica/share claim remains absent. |
| F-1-11 | Fixed: Terms gives acceptable-use instructions, not a rejection promise. |
| F-1-12 | Fixed: tracking checks cover every named route and private/owner states. |
| F-1-13 | Fixed: free, connection, and tracking facts are above the phone fold. |
| F-1-14 | Fixed: CSV template, preview, validation, duplicate skip, import, and undo exist. |
| F-1-15 | Fixed: the wordmark consistently names Client Request Catalog. |
| F-1-16 | Fixed: wording is “private client link,” then “client link.” |
| F-1-17 | Fixed: “offers that need a quote” replaces “quote-first.” |
| F-1-18 | Fixed: the section is “Charges and availability.” |
| F-1-19 | Fixed: the demo action is “Set up your catalog.” |
| F-1-20 | Fixed: no README sentence exceeds 22 words. |
| F-1-21 | Fixed: README names the Entra tenant instead of calling defaults safe. |
| F-1-22 | Fixed: route `og:url` values match canonicals. |
| F-1-23 | Fixed: private-catalog titles are bounded and product-specific. |
| F-2-1 | Fixed: sample PDF parses, has a page, and exposes known text. |
| F-2-2 | Fixed: request claim reads and matches the owner inbox. |
| F-2-3 | Fixed: tagged no-checkout test checks controls, traffic, state, and mutations. |
| F-2-4 | Fixed: copy says review requests and contact the client outside the app. |
| F-2-5 | Fixed: stored fields are checked in API output and SQLite. |
| F-2-6 | Fixed: exports are buttons; no protected API export anchor remains. |
| F-2-7 | Fixed: runtime test starts without `PORT` and reaches 8080. |
| F-2-8 | Fixed: exact collected fields and “owner workspace” replace vague wording. |
| F-2-9 | Fixed: live sitemap includes `/owner`. |
| F-2-10 | Fixed: generated audit matches current DOM, metadata, README, and catalog description. |

F-3-1 through F-3-3 are narrower claim-proof gaps not raised earlier; the
related product behavior was present in live/manual checks.

## Structure, accessibility, and visual identity

- `/`, `/demo`, `/owner`, `/privacy`, and `/terms` return 200. An unknown route
  returns HTTP 404 with a designed page and **Return home**.
- Every route has `lang="en"`, one H1, one main landmark, ordered headings,
  title under 60 characters, plain description, canonical, matching `og:url`,
  1200 × 630 product art, Twitter card, SVG favicon, and 180 px touch icon.
- The live sitemap lists all five real routes. Every visible same-origin link
  resolves to 200; the 404 page's skip link correctly stays on the 404.
- Privacy navigation, Back, and Forward focus the new H1 and update the polite
  route announcer after rendering.
- `/opt/fleet/lib/verify-url.sh` passed all five real routes with no console or
  page errors. The deliberate 404 produces only the expected failed-document
  console entry.
- Live Playwright Axe scans found zero serious or critical findings on all real
  routes and the 404 in light and dark schemes at 390 px. There is no
  horizontal overflow or visible target below 44 × 44 px. Reduced motion is
  respected.
- The dithered trade-print palette, halftone field, stamped controls, square
  rules, generated request-slip still life, and ledger rhythm match the design
  thesis and are not a generic SaaS template.
- Live request logs saw only the product origin. Security headers are present,
  and no runtime provider key or AI call is embedded.

## Quality gates

The clean clone passed all 21 exact claim commands, `npm test` (3/3),
`npm run check`, `npm run audit:copy`, `npm run build`, Rust formatting,
`cargo test --locked` (11/11), Clippy with warnings denied, and
`npm run test:e2e` (23/23). Initial landing JavaScript is 42.54 KB raw / 13.07
KB gzip; the 67.60 KB gzip authentication chunk is lazy.

## Missed leverage

No missing AI step is justified. Offer and request data are structured, and a
generated drafting/classification feature would add cost and privacy work
without removing the main friction. CSV import plus CSV/PDF export already
provides the obvious data bridge. Sync is not necessary for the single-owner,
private-link workflow described by the available scope evidence.

## What would make this perfect

Make the three green tests prove every word of their claims: exercise all three
request statuses, exclude every second-client field from an individual export,
and prove the demo writes no persistent browser store and resets on reload.
Then rerun all 21 exact claim commands and the complete suite from another
clean clone. No copy, demo UI, routing, accessibility, visual, or missed-feature
change is otherwise required by this review.
