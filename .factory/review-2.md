# Adversarial first-read review 2

Reviewed 2026-09-02 against the live deployment at
`https://client-request-catalog.sociobot.in` and repository base
`c08fa4b1564ef1b2d192fd1a44993480f75f1ecc`. The live `/health` response
reported build `466f5075d08dfb928a70a5c55525c488d33f8dd5` and `ok: true`.

## Verdict

**FAIL — 10 findings: 3 blocking, 4 major, and 3 minor.**

The cold first screen is clear, the owner-facing sample opens in one click,
Reset works, demo changes remain in memory, the visual identity is distinct,
and every registered command exits successfully. The sample's **Export PDF**
action produces an invalid file, however. Two green claim tests also omit
assertions required by their own claim records. Unlisted privacy, reply, and
runtime claims prevent a PASS. A PASS requires zero findings and no untested
claim.

`.factory/brief.json` is absent from this checkout. Scope was therefore checked
against the product contract, `.factory/design.md`, README, claims, live UI,
and implementation.

## Cold first screen

Fresh Chromium contexts with no cookies or stored data opened `/` at 390 × 844
and 1440 × 900. Nothing was scrolled before these answers were recorded.

- What it does, in my words: gives a small business a private price catalog and
  a place to collect client requests.
- For whom: small businesses serving repeat clients.
- First click: **Try it with sample data**.

All three answers are visible above the fold at both sizes. The exact supporting
copy is “Create private catalogs for repeat clients,” “Small businesses share
prices, collect clear requests, and manage each offer without running a
checkout,” and “Try it with sample data.” The adjacent line says, “One click
opens a filled owner workspace.” The three facts are also above the fold on the
390 px screen. This check passes.

## Findings

### Blocking

#### F-2-1 — The demo's “Export PDF” file is not a valid PDF

- Location/quote: `/?demo=1`, **Export PDF**. The downloaded
  `client-requests.pdf` is 257 bytes. It contains `%PDF-1.4`, plain request
  text, and `%%EOF`, but no PDF object, page tree, cross-reference table, or
  trailer. The source constructs the same header/text/footer string in
  `src/main.ts`.
- Why this fails: the one-click sample presents export as a working owner task,
  but a PDF reader cannot open this file as a document. The
  `owner-exports` claim test would not catch this class of defect because it
  checks a header and searchable strings, not whether a PDF parser can open the
  result. A prominent result-naming action that produces a corrupt result is a
  broken demo and an incompletely proved claim.
- Concrete fix: generate demo PDFs with the same valid PDF builder used by the
  backend, or call a browser-safe shared implementation. Extend
  `@claim:owner-exports` to download both real and demo PDFs, open each with a
  PDF parser, assert at least one page, and extract the known reference, client,
  and offer text.

#### F-2-2 — The request-inbox claim test never reads the owner inbox

- Location/quote: `.factory/claims.json`, `request-inbox`: “A valid client
  request appears in the owner inbox.” Its sandbox says to “read the
  authenticated inbox.” The tagged test submits a request and checks only the
  client-side success message `/Request CRC-\d{6} is in the inbox/`.
- Why this fails: the UI can display that message even if the request was not
  stored or returned to the owner. The landing claim “Review selected offers,
  contact details, and notes together” is also not asserted. This is an
  untested listed claim even though the command exits zero.
- Concrete fix: after the browser submission, fetch the authenticated owner
  overview or open the owner workspace. Assert the same reference, name, email,
  note, quantity, and selected offer appear in the inbox. Keep the client
  receipt assertion as a separate check.

#### F-2-3 — The no-checkout claim test omits its required checkout assertion

- Location/quote: `.factory/claims.json`, `no-checkout`: “Sending a request does
  not charge the client, reserve stock, or create a purchase.” Its sandbox
  requires “assert no checkout link or third-party request exists.” The exact
  `@claim:no-checkout` test records origins and checks a sample receipt, but it
  never asserts that no checkout or purchase action exists.
- Why this fails: `npm run test:e2e -- --grep @claim:no-checkout` excludes the
  separate untagged test named “operator-gated checkout is not advertised.” It
  also does not inspect request state for a purchase, reservation, or stock
  change. The green registered command therefore does not prove the complete
  claim or the related live wording “promise availability” and “guarantee a
  price.”
- Concrete fix: put the no-checkout DOM and state assertions inside the tagged
  test. After submitting fixed-price and needs-a-quote items, assert there is no
  checkout/payment action, no third-party request, and no purchase/reservation
  record or stock mutation. Align the landing and Terms wording with the exact
  registered claim.

### Major

#### F-2-4 — “Reply from the inbox” promises a control that does not exist

- Location/quote: landing step, “Reply from the inbox.” Related copy says “The
  business confirms every request directly”; README says owners can “manage
  requests”; Privacy says stored details let the business reply; Terms says the
  business confirms availability and terms directly.
- Why this fails: the owner inbox shows an email address as plain text. It has
  status, export, and delete controls, but no reply, email, copy-contact, or
  response action. No claim entry defines reply or request-status behavior.
  A normal owner would expect the advertised next step to be actionable.
- Concrete fix: either add **Email client** for each request with a `mailto:`
  address, reference-bearing subject, and a tested keyboard-accessible result,
  or rewrite the step to “Review requests in the inbox” and state “Contact the
  client outside this app.” Replace vague “manage requests” with the exact
  supported actions and register status changes if they remain advertised.

#### F-2-5 — The data-storage disclosure is an unlisted privacy claim

- Location/quote: README, “Real requests store contact details and selected
  offers so the business can reply.” `/privacy`: “A submitted request stores
  your name, email, selected offers, and optional contact details.”
- Why this fails: visitors rely on this statement to understand what is stored.
  `individual-request-privacy` starts after records exist and tests one-record
  export/deletion; it does not register or prove the disclosed stored fields.
  Privacy claims require a claims entry and direct storage/API evidence.
- Concrete fix: add a `request-data-stored` claim and tagged test. Submit known
  name, email, phone, reference, note, and offers; read the authenticated record
  and database schema; assert exactly which submitted fields are retained.

#### F-2-6 — Five visible demo export links crawl to 401 responses

- Location/quote: `/demo` exposes **Export CSV**, **Export PDF**, and three
  **Export this request** anchors. Their raw `href` values are protected
  `/api/admin/...` URLs. A clean crawl returned 401 for all five.
- Why this fails: normal clicks work only because JavaScript prevents link
  navigation. Open-in-new-tab, copy-link, non-JavaScript use, and link crawlers
  reach an unauthorized endpoint. These are actions implemented as dead links,
  contrary to the route/link contract.
- Concrete fix: render demo exports as buttons that generate downloads, or use
  actual blob/download URLs. For the real authenticated workspace, use buttons
  for token-bearing fetch actions. Add a crawler test that requests every
  anchor and permits only 200 responses, explicit downloads, or documented
  external schemes.

#### F-2-7 — The documented default port is an unlisted, untested claim

- Location/quote: README, “`PORT` defaults to `8080`.”
- Why this fails: `operator-config` tests a server with an explicitly supplied
  port. Its registered claim covers `DATA_DIR`, restart persistence, and Entra
  overrides, not startup with `PORT` absent. An operator can rely on the default
  while no claim entry proves it.
- Concrete fix: add the default-port behavior to `operator-config` and start a
  clean server with `PORT` unset, then assert `/health` on port 8080; or remove
  the default statement and require an explicit port.

### Minor

#### F-2-8 — “Clear requests” is vague copy, not an observable result

- Location/quote: landing lede, “collect clear requests”; heading, “From
  private client link to clear request”; metadata and catalog description,
  “clear quote/client requests.” README also calls the sample “owner-facing.”
- Why this fails: “clear” is a subjective marketing adjective and does not name
  the information collected. “Owner-facing” is less direct than the product's
  chosen term “owner workspace.”
- Concrete fix: use “collect contact details, selected offers, and notes” and
  “From private client link to request inbox.” Rewrite the README sentence as
  “Open `/?demo=1` to try a sample owner workspace.”

#### F-2-9 — The sitemap omits the `/owner` route

- Location: live and repository `sitemap.xml` lists `/`, `/demo`, `/privacy`,
  and `/terms`, but not `/owner`.
- Why this fails: `/owner` is a real, linked, deep-linkable setup/sign-in route.
  The site-structure contract requires every real route in the sitemap.
- Concrete fix: add `/owner` to `sitemap.xml`. If it must stay out of search,
  use route-level `noindex` metadata and document that deliberate exception
  rather than silently omitting it.

#### F-2-10 — The repository copy audit does not describe the current README

- Location: `.factory/copy-audit.md` says it audited 2026-09-02, but it lists
  removed sentences such as “Client Request Catalog is for small service and
  goods businesses...” and omits current sentences such as “`PORT` defaults to
  `8080`.” It also counts “Try it with sample data” as six words; it has five.
- Why this fails: the required plain-language proof cannot be reproduced from
  the current product copy, and it hid F-2-7 and the current README wording.
- Concrete fix: generate `.factory/copy-audit.md` from the current landing DOM,
  metadata, catalog description, and README during the build or test. Fail the
  check when extracted copy differs from the committed audit.

## Copy audit

Counts treat a hyphenated compound or path as one word. Commands are excluded.
Repeated identical navigation/footer labels are listed once. No sentence
exceeds 22 words and no banned marketing word appears. Flags below concern
vague copy, unsupported behavior, or claim coverage rather than length.

### Landing page

| Copy | Words | Flag |
| --- | ---: | --- |
| Client Request Catalog | 3 | — |
| Demo | 1 | — |
| Owner workspace | 2 | — |
| Privacy | 1 | — |
| Create private catalogs for repeat clients | 6 | — |
| Small businesses share prices, collect clear requests, and manage each offer without running a checkout. | 15 | F-2-8 |
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
| From private client link to clear request | 7 | F-2-8 |
| Set your business name. | 4 | — |
| Create the owner workspace with Microsoft sign-in. | 7 | — |
| Share the catalog. | 3 | — |
| Only people with that private client link can view its prices. | 11 | — |
| Reply from the inbox. | 4 | F-2-4 |
| Review selected offers, contact details, and notes together. | 8 | F-2-2 |
| Charges and availability | 3 | — |
| This is not a checkout | 5 | — |
| It does not charge clients, reserve stock, or promise availability. | 10 | F-2-3 |
| The business confirms every request directly. | 6 | F-2-4 |
| Private request catalogs for small businesses. | 6 | — |
| Original illustration generated with Azure AI Foundry. | 7 | — |
| Terms | 1 | — |
| Built by Param Factory | 4 | — |
| A blank request slip beside a ruler and spool in two-colour print. | 12 | — |
| Create private client catalogs, collect clear quote requests, and manage them in one owner inbox. | 15 | F-2-8 |

The two primary actions are result-naming verbs. Navigation items are links,
not buttons.

### README

| Copy | Words | Flag |
| --- | ---: | --- |
| Client Request Catalog | 3 | — |
| Client Request Catalog helps small businesses share private prices and collect requests without checkout. | 14 | — |
| Open `/?demo=1` for a one-click, owner-facing sample. | 8 | F-2-8 |
| It starts with three offers, two private client links, and three requests. | 12 | — |
| Demo changes stay in browser memory and never enter the real inbox. | 12 | — |
| Open `/owner` to create the first owner workspace. | 8 | — |
| Sociobot Microsoft Entra External ID is the only owner sign-in method. | 11 | — |
| The owner can name the catalog, maintain offers, import a CSV price sheet, issue client links, and manage requests. | 19 | F-2-4 |
| The product is free to use and requires an internet connection to load. | 13 | — |
| One catalog can contain fixed prices and offers that need a quote. | 12 | — |
| Run | 1 | — |
| `PORT` defaults to `8080`. | 4 | F-2-7 |
| Set `DATA_DIR` when local data should live somewhere other than `/data`. | 12 | — |
| Mount `/data` on durable storage when deploying. | 7 | — |
| The default sign-in configuration points to Sociobot’s Entra tenant. | 9 | — |
| Operators may set `ENTRA_TENANT_ID`, `ENTRA_TENANT_SUBDOMAIN`, and `ENTRA_CLIENT_ID` for another tenant. | 16 | — |
| Deploy | 1 | — |
| Build the root Dockerfile and mount durable storage at `/data`: | 10 | — |
| Verify | 1 | — |
| Every visitor-facing claim is registered in `.factory/claims.json`. | 7 | F-2-4, F-2-5, F-2-7 |
| The browser suite covers every registered claim. | 7 | F-2-1, F-2-2, F-2-3 |
| It also checks accessibility, routing, metadata, image delivery, offline behavior, and rate limits. | 13 | — |
| Privacy | 1 | — |
| No product page loads analytics, advertising, remote fonts, or tracking scripts. | 11 | — |
| Real requests store contact details and selected offers so the business can reply. | 13 | F-2-4, F-2-5 |
| Owners can export request rows as CSV or PDF. | 9 | F-2-1 |
| They can delete one request without exposing other clients. | 9 | — |
| Deletion keeps only an internal request ID, action, and date. | 10 | — |
| Sending a request never starts checkout or charges a client. | 10 | F-2-3 |
| The footer discloses the original image generation with Azure AI Foundry. | 11 | — |

## Demo and sandbox evidence

- `/` reaches `/?demo=1` in one click at phone and desktop widths.
- The first sample screen shows “North Street Workshop request desk,” export
  actions, and owner controls. It contains three offers, two private client
  links, and three requests with realistic names, notes, statuses, and offers.
- The persistent strip says “Demo — sample data, nothing is saved” and offers
  **Reset demo** and **Set up your catalog**.
- Editing the first offer changed it to “Live review edit.” **Reset demo**
  restored “Quarterly maintenance visit.”
- A sample client submission returned “Sample request DEMO-0424 added to the
  sample inbox. Nothing was saved.”
- The complete live flow made no POST or other non-GET request. All requests
  were same-origin. `localStorage`, `sessionStorage`, and IndexedDB were empty.
- The clean-clone isolation test compared the authenticated real inbox before
  and after a sample submission and passed.
- CSV download contained its header and all three seeded rows. PDF download is
  the blocking defect in F-2-1.

## Claims audit

Every exact `test` value in `.factory/claims.json` was run independently from
clean clone `/tmp/crc-review2-claims.nBauZz/repo` after `npm ci`.

| Claim | Command result | Evidence assessment |
| --- | --- | --- |
| `one-click-owner-demo` | PASS | One click, 3 offers, 2 links, 3 requests, edit, and reset observed. |
| `demo-isolated` | PASS | No demo API request and no change to the authenticated real inbox. |
| `owner-onboarding` | PASS | Setup, catalog name, offer, link, and rename completed. |
| `entra-owner-auth` | PASS | Authority/client ID, redirect, legacy-header rejection, and no password field checked. |
| `private-prices` | PASS | 40-character link, assigned catalog, expiry at test clock, revocation, and 410 states checked. |
| `request-inbox` | PASS command; incomplete proof | Client receipt checked, owner inbox not read (F-2-2). |
| `owner-exports` | PASS command; incomplete proof | Known contents checked, but no parser validates PDF structure and the demo PDF is invalid (F-2-1). |
| `client-offer-visibility` | PASS | Two links returned distinct assigned offer IDs. |
| `mixed-price-modes` | PASS | Fixed and needs-a-quote offers appeared in one sample inbox row. |
| `offer-maintenance` | PASS | Edit, archive, restore, and delete controls completed. |
| `csv-offer-import` | PASS | Preview, duplicate skip, import, and undo completed. |
| `individual-request-privacy` | PASS | One export excludes the other client; one deletion leaves the other request. |
| `deletion-audit-minimal` | PASS | Audit response contains only action, date, and request ID. |
| `generated-art-disclosure` | PASS | Footer disclosure is visible. |
| `no-trackers` | PASS | Landing, demo, legal, 404, private catalog, and owner routes stayed same-origin. |
| `no-checkout` | PASS command; incomplete proof | Same-origin receipt checked, required no-checkout/state assertion omitted (F-2-3). |
| `free-access` | PASS | Free fact and absence of checkout/subscription controls checked. |
| `online-required` | PASS | Fresh offline context could not load the product. |
| `operator-config` | PASS | Custom data directory, restart persistence, and all Entra overrides checked. |

Unlisted claim findings are F-2-4, F-2-5, and F-2-7. The vague “clear
requests” wording in F-2-8 should be replaced rather than registered.

## Earlier-finding verification

Every finding in `.factory/review-1.md`, every claimed repair in
`.factory/polish-1.md`, and the current `.factory/handoff.md` were checked
against both live behavior and current code. None of the round-one findings
requires repetition under its old ID.

| Earlier finding | Current verification |
| --- | --- |
| F-1-1 | Fixed: one-click demo is a seeded owner workspace with client switching and memory-only writes. |
| F-1-2 | Fixed: private-link test advances a test clock and asserts expired access returns 410. |
| F-1-3 | Fixed as written: known request contents are asserted in both real exports. F-2-1 is a new structural-validity/demo defect. |
| F-1-4 | Fixed: edit, archive, restore, and delete exist in demo, UI, API, and tests. |
| F-1-5 | Fixed: registered one-click claim starts at `/` and checks seeded rows. |
| F-1-6 | Fixed: mixed price modes have a registered test. |
| F-1-7 | Fixed: the old no-required-environment statement is gone. F-2-7 concerns the new default-port sentence. |
| F-1-8 | Fixed: custom SQLite directory and restart persistence are registered and tested. |
| F-1-9 | Fixed: exact Entra defaults and all three overrides are tested. |
| F-1-10 | Fixed: deployment replica/share assertion was removed. |
| F-1-11 | Fixed: traffic-rejection promise was replaced with acceptable-use instructions. |
| F-1-12 | Fixed: request logging now covers all named public, private, and owner routes. |
| F-1-13 | Fixed: free, connection, and tracking facts are above the mobile fold and registered. |
| F-1-14 | Fixed: CSV template, preview, validation, duplicate handling, import, and undo work. |
| F-1-15 | Fixed: wordmark consistently says Client Request Catalog. |
| F-1-16 | Fixed: public copy uses “private client link,” then “client link.” |
| F-1-17 | Fixed: “quote-first” was replaced with “offers that need a quote.” |
| F-1-18 | Fixed: section label is “Charges and availability.” |
| F-1-19 | Fixed: demo action says “Set up your catalog.” |
| F-1-20 | Fixed: no current README sentence exceeds 22 words. |
| F-1-21 | Fixed: vague “safe defaults” wording is gone. |
| F-1-22 | Fixed: every tested route's `og:url` matches its canonical URL. |
| F-1-23 | Fixed: private catalog title is bounded and includes the product name. |

## Structure, accessibility, and visual identity

- `/`, `/demo`, `/owner`, `/privacy`, `/terms`, and an unknown route have one
  H1, one main landmark, route-specific title/description/canonical/OG data,
  favicon, apple-touch icon, consistent header/footer, and no horizontal
  overflow at 390 px.
- The OG image is a real 1200 × 630 product image. Unknown URLs return HTTP 404
  and show a designed page with **Return home**.
- Back and Forward restore the correct route, H1 focus, and polite announcement.
- Live Axe scans in light and dark schemes found zero serious or critical
  issues. Visible phone controls measured at least 44 × 44 px. Reduced-motion
  CSS removes meaningful transition duration.
- `/opt/fleet/lib/verify-url.sh` passed `/`, `/?demo=1`, `/privacy`, and
  `/terms` with titles, language, one H1, main, alt text, labeled buttons, and
  zero console errors.
- The dithered two-colour trade-print layout, generated request-slip image,
  typography, square controls, and paper texture form a recognizable identity;
  this is not a generic gradient/card SaaS template.
- The live link crawl is clean except for F-2-6. The sitemap omission is F-2-9.

## Quality gates

The full gates also ran in the clean clone:

- `npm test`: PASS, 3 tests.
- `npm run check`: PASS.
- `npm run build`: PASS; `dist/` produced. Initial JS is 40.69 KB raw / 12.42
  KB gzip. The 67.60 KB gzip auth chunk is lazy.
- `cargo fmt --manifest-path backend/Cargo.toml -- --check`: PASS.
- `cargo test --locked --manifest-path backend/Cargo.toml`: PASS, 11 tests.
- `cargo clippy --locked --manifest-path backend/Cargo.toml --all-targets -- -D warnings`: PASS.
- `npm run test:e2e`: PASS, 21 tests.

## Missed leverage

No AI step is justified for this job. Offer and request records are structured,
and adding generated text would add cost and privacy work without removing the
main friction. CSV import/export already supplies the obvious data bridge.

The obvious missing action is a direct way to contact the requester, described
in F-2-4. A `mailto:` action with a prefilled reference is sufficient; it does
not need the Sociobot AI gateway.

## What would make this perfect

Produce a parseable demo PDF and validate every PDF with a parser. Make the
request-inbox and no-checkout claim tests prove their complete statements.
Register storage and default-port behavior. Either implement the advertised
reply action or describe the external handoff plainly. Replace intercepted API
anchors, add `/owner` to the sitemap, remove vague “clear” copy, and regenerate
the copy audit from the current source. Then rerun every claim and the complete
live checklist from a fresh context.
