# Handoff — polish round 1

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

The final source commit, deployed `/health` build SHA, live URL verifier results, and Lighthouse measurements are appended after deployment.

## Known gaps

None. The paid tier remains intentionally absent because no owned Sociobot billing product is enabled. The free workflow is complete.
