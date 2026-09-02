# Verification handoff — Client Request Catalog

## Outcome

**FAIL — candidate `f75e3f244969f3e6d49898b829b1c0343268cc0d` is not ready for release.**

The deployed site at `https://client-request-catalog.sociobot.in` matches the
candidate and works end to end. All 20 registered claim commands pass after a
clean install. Release is blocked because the required full browser suite is
reproducibly non-green and README contains an unregistered request-update
claim. Full evidence is in `.factory/verification-9.md`.

## Blocking defects

1. **High:** `npm run test:e2e` passed 21/22 and failed the 4×-throttled mobile
   long-task assertion: 206 ms measured, limit below 100 ms. Repeats failed 4/5
   with default workers and 2/5 serially.
2. **Medium:** README says owners can “update” requests, but no
   `.factory/claims.json` entry or tagged claim test proves request status
   updates.

## What was verified

- First-read and one-click sample demo gate passed on desktop and 390 px mobile.
- Every exact claim command passed after `npm ci`.
- Unit tests, typecheck, lint, copy audit, Vite production build, Rust format,
  11 Rust tests, strict Clippy, locked release build, and runtime tests passed.
- Live normal submission, invalid input and recovery, fixed/POA offers, sample
  reset, CSV/PDF evidence, privacy storage boundaries, and internal links
  passed.
- Live build SHA and candidate asset hashes matched.
- Public rate limit: 40-request burst at 20/s; a 120-request burst returned 76
  responses with 429 and `Retry-After: 1`. Owner burst allowance was 8.
- Entra authority is `sociobotcustomers.ciamlogin.com`; no alternate password
  sign-in was present.
- URL verifier, Axe, keyboard/focus, reduced motion, dark mode, touch targets,
  response security headers, cache policy, and same-origin request logging
  passed.
- Lighthouse: 100/100/100/100, LCP 1.354 s, CLS 0, TBT 0 ms, 86.2 KB transfer.
- Docker/Podman were unavailable; exact Vite and locked Rust release builds did
  run successfully.

## Reproduce

    npm ci
    npm test
    npm run check
    npm run audit:copy
    cargo fmt --manifest-path backend/Cargo.toml -- --check
    cargo test --locked --manifest-path backend/Cargo.toml
    cargo clippy --locked --manifest-path backend/Cargo.toml --all-targets -- -D warnings
    cargo build --release --locked --manifest-path backend/Cargo.toml
    npm run test:runtime
    npm run test:e2e
    npm run test:e2e -- --grep 'mobile landing uses the small hero' --repeat-each=5 --workers=1

## Known gaps and next steps

- Repair the mobile long-task test/product path until the full suite is stable.
- Register and prove request status updates, or remove that README claim.
- The researched subscription model is not implemented; the current product
  explicitly and honestly presents itself as free.
- Reverify and redeploy only from the repaired candidate.
