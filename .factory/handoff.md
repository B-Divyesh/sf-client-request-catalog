# Handoff — adversarial first-read review 2

## Outcome

**FAIL.** `.factory/review-2.md` records 10 findings: 3 blocking, 4 major,
and 3 minor. No product code was modified.

The live first screen is clear at 390 px and desktop widths. The one-click
owner demo is realistic, Reset works, and sample changes remain in memory with
same-origin traffic only. The blocking issues are an invalid demo PDF and two
registered claim tests that do not prove their complete claims.

## Verification

Live deployment checked:

- `https://client-request-catalog.sociobot.in`
- `/health` build: `466f5075d08dfb928a70a5c55525c488d33f8dd5`
- fresh Chromium contexts at 390 × 844 and 1440 × 900
- demo edit/reset/client submission, browser storage, and request log
- route metadata, 404, Back/Forward focus, all visible links, mobile targets,
  light/dark Axe scans, and reduced-motion behavior
- `/opt/fleet/lib/verify-url.sh` on home, demo, Privacy, and Terms

Clean clone used for tests:

    /tmp/crc-review2-claims.nBauZz/repo

Every exact command in `.factory/claims.json` exited successfully. Full gates
also passed:

    npm test
    npm run check
    npm run build
    cargo fmt --manifest-path backend/Cargo.toml -- --check
    cargo test --locked --manifest-path backend/Cargo.toml
    cargo clippy --locked --manifest-path backend/Cargo.toml --all-targets -- -D warnings
    npm run test:e2e

The complete browser suite reported 21 passing tests. See
`.factory/review-2.md` for why green automation does not support a PASS.

## Next steps

Resolve F-2-1 through F-2-10, add the missing claim assertions and entries,
then rerun the review from fresh browser contexts. Preserve the product's
distinct dithered trade-print design and the working memory-only demo model.
