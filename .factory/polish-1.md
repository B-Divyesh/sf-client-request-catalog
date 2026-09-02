# Polish round 1 — review finding closure

Candidate base: `32e99780416dcf917a897eab640ba98256920238`  
Review: `53f4820c10551104f51925f49575eb086c39a22b`  
Repair date: 2026-09-02

| Finding | Change made | Evidence |
| --- | --- | --- |
| F-1-1 | `/?demo=1` and `/demo` now open a seeded owner workspace. The demo supports offer maintenance, link assignments, request status, export, deletion, reset, and client-view switching in memory. | `@claim:one-click-owner-demo`, `@claim:demo-isolated`; `.factory/evidence/demo-owner-desktop.png`; live `/?demo=1` |
| F-1-2 | Added a test-only clock header. The private-link claim now advances beyond expiry and asserts HTTP 410 before testing revocation. | `@claim:private-prices`; live `/health` plus deployed API suite |
| F-1-3 | The export test creates a known request. It asserts reference, name, email, quantity, and offer text in CSV and PDF. | `@claim:owner-exports` |
| F-1-4 | Added real edit, archive, restore, and delete endpoints and owner controls. Referenced offers return 409 on deletion and remain archivable. | `@claim:offer-maintenance`; `real owner offer lifecycle preserves referenced requests...` |
| F-1-5 | Registered and tested the one-click filled owner demo from `/`. | `@claim:one-click-owner-demo`; `.factory/evidence/landing-mobile.png` |
| F-1-6 | Reworded the feature and tested one fixed-price plus one needs-a-quote offer in one sample request. | `@claim:mixed-price-modes` |
| F-1-7 | Removed the unregistered no-configuration sentence. Runtime instructions now name concrete variables. | README audit; `@claim:operator-config` |
| F-1-8 | Registered the SQLite location and restart behavior. A temp-directory server restart proves retained workspace data. | `@claim:operator-config` |
| F-1-9 | Replaced “safe defaults” with exact tenant wording. Runtime tests prove all three Entra overrides. | `@claim:entra-owner-auth`, `@claim:operator-config` |
| F-1-10 | Removed the unverifiable live replica/share assertion from README. | README copy audit |
| F-1-11 | Replaced the traffic-rejection promise with an acceptable-use instruction. Rate limits remain tested as product behavior. | `desktop/mobile keyboard, accessibility, offline, metadata and limits pass` |
| F-1-12 | Expanded request logging across home, demo, privacy, terms, 404, private catalog, and authenticated owner routes. | `@claim:no-trackers` |
| F-1-13 | First-screen facts now state price, connection need, and tracking policy. | `@claim:free-access`, `@claim:online-required`, `@claim:no-trackers`; `.factory/evidence/landing-mobile.png` |
| F-1-14 | Added CSV template download, preview, row validation, duplicate skipping, transactional import, and undo. Manual entry remains. | `@claim:csv-offer-import`; real import assertions in the owner lifecycle test |
| F-1-15 | Replaced “Request Slip” with “Client Request Catalog” in the wordmark and accessible label. | `@claim:one-click-owner-demo`; screenshots |
| F-1-16 | Standardized access wording to “private client link,” then “client link.” Removed “opaque.” | `.factory/copy-audit.md`; banned-word scan |
| F-1-17 | Replaced “quote-first” with “offers that need a quote.” | `@claim:mixed-price-modes`; `.factory/copy-audit.md` |
| F-1-18 | Replaced “Clear boundaries” with “Charges and availability.” | `.factory/copy-audit.md`; landing screenshot |
| F-1-19 | Replaced “Start for real” with “Set up your catalog.” | `@claim:owner-onboarding`; demo screenshot |
| F-1-20 | Split the 37-word README inventory into short sentences. | `.factory/copy-audit.md`; README |
| F-1-21 | Replaced “safe defaults” with “The default sign-in configuration points to Sociobot’s Entra tenant.” | `@claim:entra-owner-auth`; README |
| F-1-22 | `setMeta` now updates `og:url` to each route’s canonical URL. | `route metadata uses each real URL and private titles stay bounded` |
| F-1-23 | Every private catalog uses the bounded title “Private catalog — Client Request Catalog.” The business name remains in the H1. | Long 120-character business-name assertion in `route metadata uses each real URL...` |

## Verification summary

- Every one of the 19 claim commands passed independently in clean clone `/tmp/crc-claims.hZARJn/repo`.
- Full Playwright suite: 21 passed.
- Local URL verifier: home and `/?demo=1` passed with zero console errors.
- Axe checks cover `/`, `/demo`, `/owner`, `/privacy`, `/terms`, and return zero serious or critical violations.
- Initial production assets: 40.69 KB JavaScript raw (12.42 KB gzip) and 12.44 KB CSS raw (3.46 KB gzip). The 67.60 KB gzip auth chunk is lazy.

Live post-deploy checks are recorded in `.factory/handoff.md`.
