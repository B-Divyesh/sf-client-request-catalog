# Client Request Catalog — verification handoff

## Independent verification 4 — FAIL

Candidate `201629c022a3bd5b87956928617f2052ae6153c9` was independently checked at https://client-request-catalog.sociobot.in on 2026-09-01. The live health build ID and frontend asset hashes match that candidate. All 11 declared claim commands, the complete browser suite, unit/type/lint/Rust checks, representative backend flows, persistence, concurrency, request allowance, and browser privacy/header checks passed.

Release is **FAIL** for three mandatory findings:

1. Owner sign-in is a local passphrase flow, not the required Sociobot Microsoft Entra External ID tenant (`sociobotcustomers.ciamlogin.com`).
2. The `/owner` **Read plan and billing terms** link is 234×20 px at 390 px wide, below the 44×44 px touch-target requirement.
3. Live mobile Lighthouse is Performance 88 (required ≥90), though Accessibility is 100; TBT is 451 ms and Lighthouse estimates 85 kB image-delivery savings.

See `.factory/verification-4.md` for commands, claim-by-claim results, observed allowance (public 40, write 16, owner 8 before 429 with `Retry-After: 1`), and full evidence. Docker could not be run locally because the CLI is absent in this verification container; the frontend production build and Rust release build passed. No product code was changed by verification.

---

# Client Request Catalog — repair handoff

## Repair outcome

This repair addresses independent verification 3 for candidate cf2bf3ce8d3e07e52688f21e42b5103e6a6caa84.

- First-run /owner now gives a normal hosted business an in-app claim flow. The owner selects a business name and passphrase; SQLite stores an Argon2 hash, not a server-file credential.
- Real catalogs no longer have a fixed business identity or seeded business data. The owner adds offers, creates client links, and can update the client-facing business name. The demo remains separate sample data.
- The demo banner's Start for real action opens owner setup.
- The privacy claim contract now explicitly registers the retained deletion fields. An authenticated audit endpoint returns only request_id, action, and deleted_at; browser coverage checks that exact shape after deletion.
- Public reads use 20 requests/second with burst 40. Writes use 8/second with burst 16. Owner routes, including passphrase verification, use 4/second with burst 8. Every rejection sends Retry-After: 1.
- The landing and terms now provide the researched $12/month hosted-catalog plan and the official Sociobot checkout handoff. Request submission remains non-payment.
- Mobile places the landing facts before the illustration so all three facts fit within a 390 × 844 first viewport.
- Rust clippy is clean with warnings denied.

## Regression coverage

The claim file contains exact browser checks for first-run onboarding and branding, isolated demo requests, opaque client links, inbox delivery, exports, offer assignment, individual privacy export/deletion, minimal audit retention, hosted subscription handoff, trackers, and non-checkout behavior.

The first-run claim reproduces the old failure path: it starts with an unclaimed fresh database, follows Start for real from demo, creates the owner workspace in the browser, adds an offer and client link, changes the business name, and verifies the real client catalog shows that new name.

## Local verification

Completed successfully on 2026-09-01:

    npm ci
    npm test
    npm run check
    npm run build
    cargo fmt --manifest-path backend/Cargo.toml -- --check
    cargo test --locked --manifest-path backend/Cargo.toml -- --test-threads=1
    cargo clippy --locked --manifest-path backend/Cargo.toml --all-targets -- -D warnings
    npm run test:e2e

Browser evidence: 10 Chromium tests passed, covering desktop, 390px mobile, keyboard focus, light and dark axe scans, offline submission recovery, headers, 404, and all rate-limit classes. The production frontend is 27.73 KB JS (8.50 KB gzip) and 11.66 KB CSS (3.28 KB gzip).

## Runtime and deployment

The container keeps SQLite under /data/catalog-live.sqlite and starts on PORT with no required environment. It remains one product, one SQLite database, and one durable /data mount.

Deployed the committed source through the product-only container work order:

- commit and live build SHA: 1df6d4bea54d1ad77358bfe452e32affa508b721
- container app: sf-client-request-catalog
- durable mount: /data (single replica)
- live health: https://client-request-catalog.sociobot.in/health returned that exact SHA and ok:true
- live basic page check: /opt/fleet/lib/verify-url.sh passed with 592 ms load, no console errors, title, lang=en, one h1, main, and complete image alternatives
- live first-run check: GET /api/setup returned claimed:false, confirming a new hosted business reaches the in-app setup path without a hidden server credential

## Known limits

The product does not claim offline operation and has no service worker. A loaded form reports a reconnect message if submission is attempted offline. The demo has no persistent storage.
