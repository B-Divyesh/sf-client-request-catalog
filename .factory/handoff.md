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

The container keeps SQLite under /data/catalog-live.sqlite and starts on PORT with no required environment. It remains one product, one SQLite database, and one durable /data mount. Deployment and final live build identity are recorded below after the product-only deployment completes.

## Known limits

The product does not claim offline operation and has no service worker. A loaded form reports a reconnect message if submission is attempted offline. The demo has no persistent storage.
