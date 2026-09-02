# Adversarial first-read review 1

Reviewed 2026-09-02 against the live deployment at
`https://client-request-catalog.sociobot.in` and repository base
`32e99780416dcf917a897eab640ba98256920238`. The live `/health` response named
build `0f5e9d9e2e59d5eef718975698d8c6845509f686`.

## Verdict

**FAIL — 23 findings: 4 blocking, 10 major, and 9 minor.**

The landing page is clear on a cold visit, the client-side demo is functional
and isolated, and every registered test command exits successfully. The demo
does not let the target business user try the owner workflow, two green claim
tests do not prove their whole claims, and a real catalog cannot maintain an
offer after it is created. Unlisted claims and copy/metadata defects also
remain. A PASS requires zero findings and no untested claim.

## Cold first screen

Fresh Chromium contexts were opened without stored state or cookies at 390 ×
844 and 1440 × 900. Nothing was scrolled before recording the result.

- What it does: creates private price catalogs and collects requests without
  checkout.
- For whom: small businesses serving repeat clients.
- First click: **Try it with sample data**.

All three answers are present above the fold at both sizes. The exact copy that
provides them is “Create private catalogs for repeat clients,” “Small
businesses can share prices, collect clear requests, and keep checkout out of
the conversation,” and “Try it with sample data.” This part is not blocking.

## Findings

### Blocking

#### F-1-1 — The demo does not demonstrate the target user's owner workflow

- Location/quote: `/demo` opens “Sample workshop for Avery at North Street”
  and provides only the client request form. “Start for real” immediately
  leaves the sandbox for Microsoft sign-in.
- Why this fails: the landing page is addressed to small businesses and
  promises an owner inbox, client links, offer assignment, CSV/PDF exports,
  and request deletion. None of those owner tasks can be tried without a real
  account. The one-click demo therefore shows the customer's half of the
  product, not the primary user's job. This is a weak demo under the mandatory
  demo-sandbox criterion.
- Concrete fix: make `/demo` open a seeded owner workspace, or add an immediate
  “View sample owner workspace” action in the persistent demo banner. Seed
  realistic offers, two private client links, and several requests with
  statuses. Let the visitor edit offers, change visibility, export, delete,
  reset, and switch to the client view. Keep all demo writes in an isolated
  in-memory or `demo:` namespace.

#### F-1-2 — The private-link claim test never tests expiration

- Location/quote: `.factory/claims.json`, `private-prices`: “Prices require an
  owner-created opaque client link that can expire or be revoked.”
- Why this fails: the tagged test creates a 30-day link, reads it, and revokes
  it. It confirms revocation and the 40-character token, but never creates or
  advances past an expiry and never observes the promised expired-link
  response. The command is green while part of the claim remains untested.
- Concrete fix: make the claim test create an already expired link through a
  test clock/fixture, or advance the server clock, then assert that catalog
  access returns 410. Keep the existing revocation assertions.

#### F-1-3 — The export claim test proves file signatures, not exported requests

- Location/quote: `.factory/claims.json`, `owner-exports`: “Owners can export
  requests as CSV and PDF.”
- Why this fails: the test creates no request. It checks only the CSV header
  and `%PDF-1.4`, so an empty or content-free export satisfies it. It does not
  prove that a request is exported.
- Concrete fix: create at least one known request, export both formats, and
  assert that the CSV has its row and the PDF contains the known reference and
  client details.

#### F-1-4 — An owner cannot correct, update, archive, or remove an offer

- Location: authenticated owner workspace and `src/main.ts`; the UI has only
  “Add offer.” The backend exposes only `POST /api/admin/products`.
- Why this fails: a typo, price change, discontinued service, or availability
  change cannot be repaired. A business cannot operate a real catalog over
  time without creating duplicate offers. This breaks the ongoing job the
  product claims to handle.
- Concrete fix: add edit and archive/delete actions for each offer, with clear
  confirmation and handling for links and requests that reference it. Add a
  claim and an end-to-end test covering a price/name update and an archive.

### Major

#### F-1-5 — The one-click filled-demo claim is unlisted

- Location/quote: landing page, “See a filled catalog in one click.” README,
  “Open /demo for a one-click isolated sample.”
- Why this fails: `demo-isolated` tests storage isolation, not the landing-page
  click count or a filled first screen. No claim entry states or tests this
  promise.
- Concrete fix: add a claim whose tagged test starts at `/`, clicks once, and
  asserts the seeded catalog, three realistic offers, and persistent demo
  banner are already visible.

#### F-1-6 — Mixed fixed-price and quote-first support is an unlisted claim

- Location/quote: landing page, “Fixed-price and quote-first offers can sit
  together.”
- Why this fails: no claim entry promises or directly tests one catalog that
  contains both modes and submits both in one request.
- Concrete fix: use plain wording—“One catalog can show fixed prices and offers
  that need a quote.”—then add a tagged demo test that selects one of each and
  confirms both appear in the sample receipt/request payload.

#### F-1-7 — The no-configuration startup claim is unlisted

- Location/quote: README, “The service runs on PORT (default 8080) with no
  required environment variables.”
- Why this fails: this is a testable deployment promise with no claim entry.
- Concrete fix: register it and start the release binary in a clean environment
  with all optional variables unset, then assert `/health` returns 200; or
  remove “with no required environment variables.”

#### F-1-8 — The SQLite storage-path claim is unlisted

- Location/quote: README, “It writes SQLite state to
  /data/catalog-live.sqlite by default, or DATA_DIR when set.”
- Why this fails: operators can rely on this persistence behavior, but no
  claim entry tests either path.
- Concrete fix: register a claim that starts the server with default and custom
  temporary data directories, writes a request, restarts, and verifies the
  expected database file and retained request.

#### F-1-9 — The Entra override claim is only partly covered and unlisted

- Location/quote: README, “Entra tenant and public client settings have safe
  Sociobot defaults and optional `ENTRA_TENANT_ID`,
  `ENTRA_TENANT_SUBDOMAIN`, and `ENTRA_CLIENT_ID` overrides.”
- Why this fails: `entra-owner-auth` confirms the defaults but does not test
  the three overrides. “Safe” is also undefined.
- Concrete fix: rewrite as “The defaults point to Sociobot’s Entra tenant. Set
  `ENTRA_TENANT_ID`, `ENTRA_TENANT_SUBDOMAIN`, and `ENTRA_CLIENT_ID` to use a
  different tenant.” Register and test the override behavior.

#### F-1-10 — The deployed-topology claim is unlisted and not sandbox-verifiable

- Location/quote: README, “The factory deployment uses the same container on
  port 8080 with one replica and its product-owned `/data` share.”
- Why this fails: there is no claim entry or repository test for the live
  replica count or mounted share. A reader cannot verify this from the shipped
  product.
- Concrete fix: remove the live topology assertion from the product README, or
  add a factory-owned deployment verification outside the product claim list
  and link to durable evidence.

#### F-1-11 — The live traffic-rejection claim is unlisted

- Location/quote: `/terms`, “The service may reject invalid, excessive, or
  automated traffic.”
- Why this fails: the browser suite checks some rate limits, but the visitor-
  facing statement has no `.factory/claims.json` entry or tagged test.
- Concrete fix: register a rate-limit claim with exact thresholds and a tagged
  test, or replace the sentence with a non-behavioral acceptable-use term.

#### F-1-12 — The privacy claim is broader than its registered test scope

- Location/quote: `/privacy`, “The app has no analytics, advertising, remote
  fonts, or tracking scripts.” The `no-trackers` entry says only “landing and
  demo flows,” and its test visits only `/` and `/demo`.
- Why this fails: “the app” includes owner, privacy, terms, 404, and private
  client routes. Those routes are outside the tagged test despite the broader
  claim.
- Concrete fix: either change the sentence to “The landing page and demo have
  no analytics, advertising, remote fonts, or tracking scripts,” or make the
  tagged request-log test visit every public route plus a seeded private link
  and authenticated owner workspace.

#### F-1-13 — The first-screen facts omit connection and price information

- Location/quote: first-screen facts are “Prices require a private link,”
  “Requests arrive in one owner inbox,” and “No analytics or tracking
  scripts.”
- Why this fails: the mandatory first-screen pattern requires privacy,
  offline/connection, and price facts. Privacy is present, but visitors are not
  told that the product requires a connection or whether using it costs money.
- Concrete fix: replace or extend the list with three verified facts such as
  “No analytics or tracking,” “Requires an internet connection,” and the exact
  current price/free status. Register and test the new claims.

#### F-1-14 — Existing price sheets cannot be imported

- Location: owner workspace; `.factory/design.md` says the audience already
  has “price sheets, bench notes, and repeat customers.”
- Why this fails: owners must retype every offer one at a time. CSV import is
  the obvious bridge from the source material named by the product's own
  design thesis.
- Concrete fix: add “Import offers from CSV” with a downloadable template,
  preview, row-level validation, duplicate handling, and an undo step. Keep
  manual entry as the fallback and add a tagged claim test using a sample CSV.

### Minor

#### F-1-15 — The header presents a second product name

- Location/quote: header wordmark “REQUEST SLIP”; page/product name “Client
  Request Catalog.”
- Why this fails: a cold visitor sees two names before the explanation, and
  “Request Slip” is not defined as a feature or short name.
- Concrete fix: use “Client Request Catalog” in the wordmark and accessible
  label, or consistently rename the product and metadata everywhere.

#### F-1-16 — One access concept has three terms, including jargon

- Location/quote: “private link,” “opaque link,” and “client link” refer to the
  same credential on the landing page and README.
- Why this fails: “opaque” is implementation jargon, and the terminology audit
  itself says the chosen term is “client link.”
- Concrete fix: use “private client link” on first mention and “client link”
  thereafter. Rewrite the landing sentence as “Only people with that private
  client link can view its prices.”

#### F-1-17 — “Quote-first” is unexplained jargon

- Location/quote: “Fixed-price and quote-first offers can sit together.”
- Why this fails: a new visitor must infer what “quote-first” means.
- Concrete fix: “One catalog can show fixed prices and offers that need a
  quote.”

#### F-1-18 — “Clear boundaries” does not name its section

- Location/quote: landing eyebrow heading, “Clear boundaries.”
- Why this fails: it is a mood label and carries no useful meaning when heard
  in a headings list.
- Concrete fix: change it to “Charges and availability,” or remove it and let
  “This is not a checkout” name the section.

#### F-1-19 — “Start for real” does not name the result

- Location/quote: persistent demo-banner action, “Start for real.”
- Why this fails: the phrase does not say that the next screen is owner setup
  with Microsoft sign-in.
- Concrete fix: change it to “Set up your catalog.”

#### F-1-20 — The README contains a 37-word sentence

- Location/quote: “The browser suite covers Entra-only ownership and branding,
  the demo sandbox, request privacy, individual export/deletion and minimal
  audit fields, opaque links, exports, generated-art disclosure,
  accessibility, mobile, keyboard, image delivery, offline failure handling,
  metadata, headers, and rate limits.”
- Why this fails: it exceeds the 22-word hard cap and scans as an inventory,
  not usable guidance.
- Concrete fix: “The browser suite covers every registered claim. It also
  checks accessibility, routing, metadata, image delivery, offline errors, and
  rate limits.”

#### F-1-21 — “Safe defaults” is vague

- Location/quote: README, “safe Sociobot defaults.”
- Why this fails: “safe” does not tell an operator what the defaults are or
  what safety property they provide.
- Concrete fix: “The defaults point to Sociobot’s Entra tenant.”

#### F-1-22 — `og:url` is wrong on every non-home route

- Location: live `/demo`, `/owner`, `/privacy`, `/terms`, and 404 metadata.
  Each retains `https://client-request-catalog.sociobot.in/` from `index.html`.
- Why this fails: route-specific Open Graph previews identify the home page
  even though the title, description, and canonical identify another route.
- Concrete fix: update `meta[property="og:url"]` inside `setMeta` to the same
  absolute URL used for the route canonical. Add route metadata assertions.

#### F-1-23 — Private-catalog titles can exceed 60 characters and omit the product name

- Location: `renderCatalog()` sets a real client route title to
  ``${catalog.business_name} — private request catalog`` while business names
  may contain 120 characters.
- Why this fails: this route can exceed the 60-character title limit and does
  not follow the “Product — what it does” pattern. A long owner-entered name
  also produces an uncontrolled browser/search title.
- Concrete fix: use a bounded route title such as “Private catalog — Client
  Request Catalog” and keep the business name in the page H1. Add a test with a
  120-character business name.

## Copy audit

Counts treat a hyphenated compound as one word. Code blocks are commands, not
sentences, and are excluded. UI labels and headings are included because the
review explicitly checks them in isolation. Repeated identical labels are
listed once.

### Landing page

| Copy | Words | Flag |
| --- | ---: | --- |
| Request Slip | 2 | F-1-15 |
| Demo | 1 | — |
| Owner workspace | 2 | — |
| Privacy | 1 | — |
| Client Request Catalog | 3 | F-1-15 |
| Create private catalogs for repeat clients | 6 | — |
| Small businesses can share prices, collect clear requests, and keep checkout out of the conversation. | 14 | — |
| Try it with sample data | 6 | — |
| See a filled catalog in one click. | 7 | F-1-5 |
| Set up your catalog | 4 | — |
| Prices require a private link. | 5 | F-1-13, F-1-16 |
| Requests arrive in one owner inbox. | 6 | F-1-13 |
| No analytics or tracking scripts. | 5 | F-1-13 |
| Client view | 2 | — |
| Show only the offers a client needs | 7 | — |
| Fixed-price and quote-first offers can sit together. | 7 | F-1-6, F-1-17 |
| Maintenance visit | 2 | — |
| Fixed price | 2 | — |
| Replacement fitting set | 3 | — |
| Price on application | 3 | — |
| Repeat supplies | 2 | — |
| Previous order | 2 | — |
| How it works | 3 | — |
| From private link to clear request | 6 | F-1-16 |
| Set your business name. | 4 | — |
| Create the owner workspace with Microsoft sign-in. | 7 | — |
| Share the catalog. | 3 | — |
| Only someone with that opaque link can view its prices. | 10 | F-1-16 |
| Reply from the inbox. | 4 | — |
| Review selected offers, contact details, and notes together. | 8 | — |
| Clear boundaries | 2 | F-1-18 |
| This is not a checkout | 5 | — |
| It does not charge clients, reserve stock, or promise availability. | 10 | — |
| The business confirms every request directly. | 6 | — |
| Private request catalogs for small businesses · Version 1.3 | 8 | — |
| Original illustration generated with Azure AI Foundry. | 7 | — |
| Terms | 1 | — |
| Built by Param Factory | 4 | — |

Non-visible but user-facing metadata also passes the word limit: the image alt
text is 12 words and the meta description is 14 words.

### README

| Copy | Words | Flag |
| --- | ---: | --- |
| Client Request Catalog | 3 | — |
| Client Request Catalog is for small service and goods businesses that share private prices with repeat clients. | 17 | — |
| An owner creates a branded catalog, chooses the offers on each opaque client link, and receives quote requests in one inbox. | 21 | F-1-16 |
| Open /demo for a one-click isolated sample. | 7 | F-1-5 |
| Open /owner to create the first owner workspace. | 8 | — |
| The first business signs in through the shared Sociobot Microsoft Entra External ID tenant, then chooses its catalog name. | 19 | — |
| The server keys ownership by Entra's stable object ID. | 9 | — |
| It stores no owner password. | 5 | — |
| Run | 1 | — |
| The service runs on PORT (default 8080) with no required environment variables. | 12 | F-1-7 |
| It writes SQLite state to /data/catalog-live.sqlite by default, or DATA_DIR when set. | 12 | F-1-8 |
| Persist /data in deployment. | 4 | — |
| Entra tenant and public client settings have safe Sociobot defaults and optional `ENTRA_TENANT_ID`, `ENTRA_TENANT_SUBDOMAIN`, and `ENTRA_CLIENT_ID` overrides. | 17 | F-1-9, F-1-21 |
| Deploy | 1 | — |
| Build the root Dockerfile and mount durable storage at `/data`: | 10 | — |
| The factory deployment uses the same container on port 8080 with one replica and its product-owned `/data` share. | 18 | F-1-10 |
| Verify | 1 | — |
| Every visitor-facing statement is registered in .factory/claims.json. | 7 | F-1-5–F-1-12 |
| The browser suite covers Entra-only ownership and branding, the demo sandbox, request privacy, individual export/deletion and minimal audit fields, opaque links, exports, generated-art disclosure, accessibility, mobile, keyboard, image delivery, offline failure handling, metadata, headers, and rate limits. | 37 | F-1-20 |
| Privacy | 1 | — |
| The demo is non-persistent. | 4 | — |
| Real requests store submitted contact details and selected offers so the business can reply. | 14 | — |
| Owners can export or delete one request. | 7 | — |
| Deletion retains only an internal request ID, action, and date. | 10 | — |
| The request flow never starts checkout or charges a client. | 10 | — |
| The footer discloses that its original request-slip illustration was generated with Azure AI Foundry. | 14 | — |

## Demo and sandbox evidence

- The landing action reaches `/demo` in one click.
- The first demo screen contains three realistic fictional offers: a quarterly
  maintenance visit, replacement fitting set, and repeat consumables pack.
- The banner says “Demo — sample data, nothing is saved” and remains visible.
- A live sample submission returned “Sample request DEMO-0421 complete.
  Nothing was saved.”
- The complete live demo flow made requests only to
  `https://client-request-catalog.sociobot.in`; its only write was
  `POST /api/demo/requests`.
- After submission, localStorage and sessionStorage were empty and
  `indexedDB.databases()` returned an empty list.
- Reset returned the request count to 0. “Start for real” targets `/owner`.
- The clean-clone `demo-isolated` test compared the real owner inbox before and
  after a demo submission and passed.

Isolation works. F-1-1 concerns the demo's incomplete owner-facing scope, not
cross-contamination.

## Claims audit

All commands were run individually from clean clone
`/tmp/crc-review1.nSQlzP/repo` after `npm ci`.

| Claim | Command result | Evidence |
| --- | --- | --- |
| `owner-onboarding` | PASS | Browser setup, offer, link, rename, and client catalog completed. |
| `entra-owner-auth` | PASS | Expected CIAM settings, redirect, no password UI, and legacy-header rejection passed. |
| `demo-isolated` | PASS | Demo submission did not change the real inbox. |
| `private-prices` | PASS command; incomplete proof | Opaque token and revocation passed; expiration was not exercised (F-1-2). |
| `request-inbox` | PASS | A client request reached the owner inbox. |
| `owner-exports` | PASS command; incomplete proof | Header/signature passed without an exported record (F-1-3). |
| `client-offer-visibility` | PASS | Two links returned different assigned offer IDs. |
| `individual-request-privacy` | PASS | One request exported/deleted while the other remained. |
| `deletion-audit-minimal` | PASS | Audit object contained only `action`, `deleted_at`, and `request_id`. |
| `generated-art-disclosure` | PASS | Visible footer disclosure found. |
| `no-trackers` | PASS within listed routes | Request log was same-origin on landing/demo; broader privacy copy is F-1-12. |
| `no-checkout` | PASS | Demo submission generated only product-origin activity. |

The unlisted claim findings are F-1-5 through F-1-12. No listed command failed,
but F-1-2 and F-1-3 leave parts of their registered claims untested.

## History check

No earlier `.factory/review-*.md` or `.factory/polish-*.md` files exist. The
existing `.factory/handoff.md` reported a candidate-7 PASS and one previously
repaired browser-history focus defect. That fix was independently confirmed on
the live site: navigation to Privacy focused its H1; Back focused the landing
H1 and updated the polite route announcer. The earlier handoff's build and
claim results were not accepted on trust; the current review reran them from a
clean clone. Findings F-1-1 through F-1-23 were not resolved by that handoff.

## Structure, links, accessibility, and visual identity

- `/`, `/demo`, `/owner`, `/privacy`, and `/terms` return 200. A made-up route
  returns a designed 404 with “Return home.”
- Every checked route has `lang="en"`, one H1, one main landmark, ordered
  headings, a consistent header/footer, a skip link, a route title under 60
  characters, description, canonical, OG/Twitter metadata, favicon, and
  apple-touch icon.
- The OG image is the product-specific 1200 × 630 request-desk artwork. The
  apple-touch icon is 180 × 180. F-1-22 records the incorrect route `og:url`.
- Every linked same-origin destination crawled from the public routes returned
  200. The deliberate unknown-route page returned 404. There were no dead
  product links.
- Desktop and 390 px views had no horizontal overflow or page/script console
  errors. The browser's expected failed-document console entry appeared only
  while loading the deliberate 404 response.
- `/opt/fleet/lib/verify-url.sh` passed: title, language, one H1, main landmark,
  alt text, labeled buttons, and zero console errors on the landing page.
- Playwright axe-core 4.11 found zero serious or critical violations on home,
  demo, owner, privacy, terms, and 404 at 390 px; light/dark checks also passed.
  The standalone axe CLI could not pair its ChromeDriver 152 with the supplied
  Playwright Chromium 145, so the equivalent in-project Playwright integration
  was used.
- The dithered trade-print palette, halftone texture, stamped controls,
  typography, original request-desk art, and styled 404 are product-specific,
  not a generic SaaS template. Reduced-motion behavior is implemented and the
  live request log shows no remote font or third-party script.

## Build verification

From the clean clone:

- `npm test`: 1/1 passed.
- `npm run check`: TypeScript and ESLint passed.
- `npm run build`: passed; `dist/` produced. Landing JavaScript was 9.20 KB
  gzip; the 67.60 KB gzip auth chunk is lazy-loaded on the owner route.
- `cargo test --locked --manifest-path backend/Cargo.toml`: 11/11 passed.
- All 12 claim commands passed as shown above.

## Missed leverage and AI check

F-1-14 records the concrete import opportunity implied by the existing-price-
sheet audience. F-1-4 records the more fundamental offer-maintenance gap.
Drafting or classification with AI is not necessary for this job, so the lack
of a runtime AI feature is not a finding. No provider or Azure model key is
embedded in the client. The generated illustration is build-time artwork and
its provenance is disclosed.

## What would make this perfect

Resolve every finding above: provide a fully isolated owner demo; let owners
maintain and import offers; complete the expiry and export tests; register or
remove every claim-like statement; replace jargon, duplicate naming, and vague
actions; state connection, privacy, and price facts on the first screen; and
set the correct route `og:url` and bounded product-specific route titles. Then
repeat the cold mobile/desktop review, submit and reset the demo, rerun every
claim from a new clone, crawl every route, and rerun accessibility checks.
There is no smaller set of changes that would make this review a PASS.
