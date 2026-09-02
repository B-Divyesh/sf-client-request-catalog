# Polish round 2 — cumulative finding closure

Candidate base: `c08fa4b1564ef1b2d192fd1a44993480f75f1ecc`  
Review commit: `8f2044d222cfe7f7ef1e440ed2d1e515a760ba39`  
Repair code commit: `d963ccd78dbf4abae0922bf8a769218ba3fb4d1d`  
Live URL: `https://client-request-catalog.sociobot.in`

## Round 2 findings

| Finding | Change made | Evidence |
| --- | --- | --- |
| F-2-1 | Replaced the sample's text-shaped PDF with a complete PDF containing catalog, page, font, content, xref, and trailer objects. The real and sample files now use equivalent builders. | `@claim:owner-exports` parses both files with PDF.js, asserts one page, and extracts the known reference, client, and offer. Live evidence: `.factory/evidence/polish-2-live.json` (`pdfPages: 1` and all three content checks `true`). |
| F-2-2 | The inbox claim now submits name, email, phone, client reference, note, quantity, and offer, then reads the authenticated owner overview and matches the stored row. | `@claim:request-inbox`; clean-clone PASS in `/tmp/crc-polish2-clean.T5g6Fd/repo`. |
| F-2-3 | The tagged no-checkout test now selects fixed-price and needs-a-quote offers, checks unchanged offers, inspects the sample inbox, rejects payment controls, and asserts GET-only same-origin traffic. | `@claim:no-checkout`; live report shows `checkoutControls: 0`, `requestMethods: ["GET"]`, and only the product origin. |
| F-2-4 | Replaced the unsupported reply promise with “Review requests in the inbox” and “Contact the client by email outside this app.” README, Privacy, and Terms now name only supported actions. | `npm run audit:copy`; live home, Privacy, and Terms checks; `.factory/evidence/polish-2-live-home/screenshot-mobile.png`. |
| F-2-5 | Added a `request-data-stored` claim. The backend overview and owner inbox now include the submitted phone and client reference. The test also reads SQLite schema and values. | `@claim:request-data-stored`; clean-clone PASS. The live demo row in `.factory/evidence/polish-2-live.json` contains every sample field. |
| F-2-6 | Changed all authenticated export anchors into buttons. Demo exports use generated downloads; real exports use authenticated fetches. | `every visible internal link resolves and exports are buttons`; live report shows `protectedExportAnchors: 0` and every internal link returns 200. |
| F-2-7 | Expanded `operator-config` to register the default port. Its runtime test launches the binary with `PORT` absent and checks `/health` on 8080. | `npm run test:runtime -- --test-name-pattern=@claim:operator-config`; clean-clone PASS. |
| F-2-8 | Replaced “clear requests” with the exact fields collected. Replaced “owner-facing” with “sample owner workspace.” | Generated `.factory/copy-audit.md`; `npm run audit:copy`; live mobile screenshot. |
| F-2-9 | Added `/owner` to the sitemap and asserted every listed real route. | `route metadata uses each real URL and private titles stay bounded`; live `/sitemap.xml` returns 200 and includes `/owner`. |
| F-2-10 | Added a generator that reads the built landing DOM, metadata, README, and catalog description. The browser suite fails if the committed audit differs. | `npm run audit:copy`; `npm run test:e2e` invokes the check; the audit has no length or banned-word flags. |

## Earlier findings rechecked

| Finding | Change retained or rechecked | Evidence |
| --- | --- | --- |
| F-1-1 | The one-click path still opens the complete sample owner workspace and can switch to the client catalog. | `@claim:one-click-owner-demo`, `@claim:demo-isolated`; live seeded counts 3 offers, 2 links, 3 requests. |
| F-1-2 | Expiry and revocation remain separate 410 checks against a 40-character client token. | `@claim:private-prices`. |
| F-1-3 | Real CSV and PDF exports contain a known request; round 2 adds structural parsing and the sample exports. | `@claim:owner-exports`. |
| F-1-4 | Edit, archive, restore, and delete remain available in the owner workspace and demo. Referenced offers remain protected. | `@claim:offer-maintenance`; `real owner offer lifecycle preserves referenced requests and removes unused offers`. |
| F-1-5 | The landing action still reaches the fully seeded owner workspace in one click. | `@claim:one-click-owner-demo`; live `oneClickUrl` in the live report. |
| F-1-6 | Fixed-price and needs-a-quote offers still appear together in one submitted request. | `@claim:mixed-price-modes`; live sample row evidence. |
| F-1-7 | No broad no-configuration sentence was restored. Concrete runtime behavior is registered instead. | README and `.factory/claims.json`; `@claim:operator-config`. |
| F-1-8 | Custom SQLite location and restart persistence remain registered and tested. | `@claim:operator-config`. |
| F-1-9 | Exact Entra defaults and all three overrides remain tested. | `@claim:entra-owner-auth`, `@claim:operator-config`. |
| F-1-10 | The unverifiable replica/topology promise remains absent from README. | Generated README section in `.factory/copy-audit.md`. |
| F-1-11 | Terms retain non-quantitative acceptable-use wording; concrete rate limiting remains an integration check. | `desktop/mobile keyboard, accessibility, offline, metadata and limits pass`. |
| F-1-12 | Tracking checks still visit landing, demo, legal, 404, private catalog, and authenticated owner routes. | `@claim:no-trackers`; live same-origin request evidence. |
| F-1-13 | The first screen still states free use, connection need, and no tracking above the fold. | `@claim:free-access`, `@claim:online-required`, `@claim:no-trackers`; live `factsAboveFold: true`. |
| F-1-14 | CSV preview, validation, duplicate skipping, transactional import, and undo remain available. | `@claim:csv-offer-import`. |
| F-1-15 | The only product name remains Client Request Catalog. | Generated landing copy audit and live screenshot. |
| F-1-16 | Access wording remains “private client link,” then “client link.” | `.factory/copy-audit.md` terminology table. |
| F-1-17 | The page continues to say “offers that need a quote.” | `@claim:mixed-price-modes`; generated copy audit. |
| F-1-18 | The section remains named “Charges and availability.” | Generated copy audit and live screenshot. |
| F-1-19 | The demo banner action remains “Set up your catalog.” | `@claim:owner-onboarding`; live demo screenshot. |
| F-1-20 | The current README has no sentence over 22 words. | `npm run audit:copy`; generated README table. |
| F-1-21 | README still names the Sociobot Entra tenant instead of calling defaults “safe.” | `@claim:entra-owner-auth`; generated README table. |
| F-1-22 | Every route still sets `og:url` to its own canonical URL. | `route metadata uses each real URL and private titles stay bounded`; live route report. |
| F-1-23 | Private catalogs retain the bounded title “Private catalog — Client Request Catalog.” | `route metadata uses each real URL and private titles stay bounded`. |

## Verification summary

- Every exact command for all 20 claims passed independently from clean clone `/tmp/crc-polish2-clean.T5g6Fd/repo`.
- The same clean clone passed 3 Node tests, 11 Rust tests, Clippy with warnings denied, the runtime suite, and 22 Playwright tests.
- Local and live URL verification found zero console errors on home, demo, Privacy, and Terms.
- Playwright Axe found zero serious or critical issues on every real route and the styled 404.
- Live Lighthouse: performance 100, accessibility 100, best practices 100, SEO 100; LCP 1.4 s, CLS 0, TBT 0 ms.
- Live screenshots: `.factory/evidence/polish-2-live-home/` and `.factory/evidence/polish-2-live-demo/`.
