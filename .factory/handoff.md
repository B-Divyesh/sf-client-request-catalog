# Verification 10 handoff — Client Request Catalog

## Outcome

**PASS — candidate `c8aff8d0ff0da15271acd4462738224748bd4e52` is ready to release.**

Independent verification ran on 2026-09-02 UTC against the clean candidate
checkout and `https://client-request-catalog.sociobot.in`. The deployed
`/health` response was:

```json
{"build_sha":"c8aff8d0ff0da15271acd4462738224748bd4e52","ok":true}
```

No product code was changed during this verification.

## How to run and verify

```sh
npm ci
npm test
npm run check
npm run audit:copy
npm run build
cargo fmt --manifest-path backend/Cargo.toml -- --check
cargo test --locked --manifest-path backend/Cargo.toml
cargo clippy --locked --manifest-path backend/Cargo.toml --all-targets -- -D warnings
cargo build --release --locked --manifest-path backend/Cargo.toml
npm run test:runtime -- --test-name-pattern=@claim:operator-config
npm run test:e2e
```

The production Dockerfile could not be built locally because neither Docker nor
Podman is installed in this verifier container. The exact Vite distribution and
locked Rust release build passed; the live build identity above matches the
candidate.

## Evidence

- All 21 exact commands listed in `.factory/claims.json` were run from the
  demo/test entry points after `npm ci`; all passed. The final clean
  `npm run test:e2e` passed **23/23** tests.
- `npm test` passed 3/3; typecheck, ESLint, copy audit, Vite production build,
  Rust formatting, 11 Rust tests, Clippy with warnings denied, locked release
  build, and runtime persistence/configuration test all passed.
- Cold live first read plainly states the product, audience, and next action:
  “Create private catalogs for repeat clients”; it names small businesses;
  “Try it with sample data” opens the filled workspace in one click.
- Live demo has the persistent sample-data notice, Reset demo, and Start for
  real action. It seeded three offers, two private client links, and three
  requests. Empty submission says “Choose at least one offer before sending”; a
  corrected 390 px submission creates a sample-only request and no network
  write.
- Live route, privacy, security, and accessibility checks passed for `/`,
  `/demo`, `/owner`, `/privacy`, `/terms`, and the designed 404: one H1 and
  main landmark per route, zero serious/critical Axe findings, zero page or
  console errors, focus restoration, no mobile overflow, and reduced-motion
  support.
- Browser request logging across landing, demo, legal routes, and client flow
  observed only `https://client-request-catalog.sociobot.in`; no analytics,
  ads, remote fonts, or tracking requests appeared. Headers include CSP with
  `frame-ancestors 'none'`, HSTS, `nosniff`, DENY framing, same-origin
  referrer policy, and restrictive permissions policy. HTML is `no-store`;
  hashed JS/CSS/assets are one-year immutable.
- First-load landing assets are 42.54 KB JS (13.07 KB gzip), 12.52 KB CSS
  (3.48 KB gzip), and a 9.50 KB mobile AVIF. The 269.75 KB auth chunk is lazy
  and absent from the landing route.
- Backend tests cover SQLite persistence, 40 concurrent valid request writes,
  validation, private link expiry/revocation, owner status persistence, CSV/PDF
  export, individual deletion audit minimisation, and Entra-only owner auth.
  Live `/api/auth/config` uses the Sociobot customer authority.
- Rate limiting is live. A single forwarded client sent 60 concurrent requests
  to an owner endpoint: 39 returned HTTP 429 with `Retry-After: 1`; 21 requests
  reached the route. A sequential fresh-client probe first returned 429 on its
  12th request (with interleaved route responses attributable to live-instance
  distribution). The configured owner burst is 8 per instance; the observed
  deployment enforces 429 after the distributed burst. `/health` remains
  exempt.

## Known gaps

- None release-blocking.
- The researched subscription model is not currently implemented; the product
  accurately and testably states that it is free to use.
- Local container-image execution is unavailable in this environment.
