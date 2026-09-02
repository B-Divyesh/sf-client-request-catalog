# Handoff — independent verification 8 (current)

## Current release decision

**PASS:** candidate `466f5075d08dfb928a70a5c55525c488d33f8dd5` at
`https://client-request-catalog.sociobot.in` is release-ready. Fresh live
`/health` returned that exact full SHA and `ok: true`.

Independent clean-clone verification ran all 19 exact claims, all local
quality gates, the 21-test browser suite, live privacy/header/accessibility
checks, mobile Lighthouse, and a live rate-limit burst. No product defects
were found. The public API allowance observed was a 40-request burst; requests
past it returned 429 with `Retry-After: 1`.

See `.factory/verification-8.md` for exact commands, evidence, and the one QA
environment limitation: Docker is not installed in this verifier container,
so local image creation was unavailable. The deployed image identity was
verified through `/health`.

## Builder handoff history

## Outcome

All 23 findings from `.factory/review-1.md` are resolved. The one-click sample is now an owner-facing, memory-only workspace. Real owners can edit, archive, restore, delete, and import offers. Expiration and exported request contents have direct behavioral proof.

The product remains a Rust axum and SQLite backend serving a Vite TypeScript frontend from one container. The dithered trade-print visual system is unchanged.

## Run and verify

    npm ci
    npm test
    npm run check
    npm run build
    npm run test:runtime
    cargo fmt --manifest-path backend/Cargo.toml -- --check
    cargo test --locked --manifest-path backend/Cargo.toml
    cargo clippy --locked --manifest-path backend/Cargo.toml --all-targets -- -D warnings
    npm run test:e2e

Every exact command in `.factory/claims.json` was also run independently from clean clone `/tmp/crc-claims.hZARJn/repo`. All 19 commands passed.

## Local evidence

- `npm test`: 3 passed.
- `npm run check`: TypeScript and ESLint passed.
- `npm run build`: `dist/` produced. Initial JavaScript is 40.69 KB raw and 12.42 KB gzip. Initial CSS is 12.44 KB raw and 3.46 KB gzip.
- `cargo test`: 11 passed.
- `npm run test:e2e`: 21 passed.
- Playwright axe: zero serious or critical issues on home, demo, owner, privacy, terms, and 404 routes.
- URL verifier: home and `/?demo=1` passed title, language, H1, main, alt, button-label, and console checks.
- Visual evidence: `.factory/evidence/landing-mobile.png`, `.factory/evidence/demo-owner-desktop.png`, and `.factory/evidence/demo-owner-mobile.png`.

## Deployment

- Deployment target: `https://client-request-catalog.sociobot.in`
- Container app scope: `sf-client-request-catalog`
- Durable data path: `/data`, one replica through the fleet deployment script.

Deployed source commit: `1a41926ee47fb5abfa8af539b209757bd850650c`.

Post-deploy evidence:

- `/health` returns the same full build SHA and `ok: true`.
- Cold URL verification passed on `/` and `/?demo=1`; both had zero console errors.
- A cold live click opened three offers, two client links, and three requests.
- Live demo edit, reset, client switching, mixed-price request, and inbox return all passed.
- Live axe scans found zero serious or critical issues on home, demo, owner, privacy, terms, and 404.
- Every named route and metadata asset returned 200. An unknown route returned the designed HTTP 404.
- Every route title is at most 60 characters. Each `og:url` matches its route canonical.
- Mobile facts remain above the 844 px fold with no horizontal overflow.
- The complete live sample flow contacted only `https://client-request-catalog.sociobot.in`.
- A 45-request live burst returned 41 successful responses and four 429 responses. Every 429 sent `Retry-After: 1`.
- Mobile Lighthouse: Performance 100, Accessibility 100, Best Practices 100, SEO 100, LCP 1,352 ms, TBT 0 ms, CLS 0.

## Known gaps

None. The paid tier remains intentionally absent because no owned Sociobot billing product is enabled. The free workflow is complete.
