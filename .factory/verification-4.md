# Independent verification 4 — FAIL

**Candidate:** `201629c022a3bd5b87956928617f2052ae6153c9`
**Live URL:** https://client-request-catalog.sociobot.in
**Verified:** 2026-09-01

## Release result

**FAIL.** The functional, privacy, backend, and most accessibility checks pass, but the candidate misses two mandatory quality thresholds and does not use the required Sociobot Microsoft Entra External ID tenant for owner sign-in.

## First-read result

Cold opening the live landing page says that it creates private catalogs for repeat clients, names small businesses as the audience, and says prices and requests are handled without checkout. The first action is **Try it with sample data**, with the plain result “See a filled catalog in one click.” The one-click `/demo` flow opened the seeded Sample workshop catalog with the persistent “Demo — sample data, nothing is saved” banner, Reset demo, and Start for real controls. This check passes.

## Required claim checks

A clean clone was checked out at the candidate SHA and installed with `npm ci`. Every command listed in `.factory/claims.json` was run separately through the browser demo entry point and passed.

| Claim ID | Result |
| --- | --- |
| `owner-onboarding` | PASS |
| `demo-isolated` | PASS |
| `private-prices` | PASS |
| `request-inbox` | PASS |
| `owner-exports` | PASS |
| `client-offer-visibility` | PASS |
| `individual-request-privacy` | PASS |
| `deletion-audit-minimal` | PASS |
| `hosted-subscription` | PASS |
| `no-trackers` | PASS |
| `no-checkout` | PASS |

The full browser suite also passed: `npm run test:e2e` — 10 passed.

## Passing evidence

- `npm test`, `npm run check`, `npm run build`, `cargo fmt --manifest-path backend/Cargo.toml -- --check`, `cargo test --locked --manifest-path backend/Cargo.toml -- --test-threads=1`, and `cargo clippy --locked --manifest-path backend/Cargo.toml --all-targets -- -D warnings` passed.
- The production frontend build is 27.73 kB JavaScript (8.50 kB gzip) and 11.66 kB CSS (3.28 kB gzip).
- `/health` on the live URL returned `ok:true` and build SHA `201629c022a3bd5b87956928617f2052ae6153c9`. Live HTML and JavaScript asset SHA-256 values exactly matched the local candidate build.
- `verify-url.sh` passed: 548 ms cold load, no page errors, `lang=en`, one `h1`, a `main` landmark, and complete image alternatives.
- Playwright on desktop and 390×844 mobile found no horizontal overflow, no serious/critical axe findings on `/`, `/demo`, `/owner`, `/privacy`, `/terms`, or the designed 404 route. Light, dark, and reduced-motion treatments loaded without page errors. Keyboard checks passed: skip link reached `main`, Enter added a demo offer, form validation was announced with `aria-live="polite"`, and navigation moved focus to the new `h1`.
- The landing and demo browser request logs contained only `https://client-request-catalog.sociobot.in`; no remote fonts, analytics, or other origins were requested. Responses supplied CSP, HSTS, `nosniff`, same-origin referrer policy, frame denial, and permissions policy headers. Hashed CSS/JS had `public, max-age=31536000, immutable` caching.
- Local server QA used a fresh temporary SQLite directory. It confirmed first setup, invalid-input 400 responses, valid fixed-price and quote-first offers, 40-character client links, private offer visibility, valid request persistence, 20 concurrent valid requests (all 200, 21 inbox records including the initial request), restart persistence, CSV/PDF behavior covered by claims, and the candidate health build identity.
- Observed request allowance by one forwarded client IP: public reads accepted 40 then returned 429 with `Retry-After: 1`; write requests accepted 16 then returned 429 with `Retry-After: 1`; owner-route traffic accepted 8 then returned 429 with `Retry-After: 1`. `/health` remained available.
- This is not a PWA and makes no offline-reload claim. It is not a library or CLI.

## Release-blocking findings

### High — owner sign-in does not use the required tenant

`/owner` creates and later opens the owner workspace using a locally supplied passphrase (`owner_passphrase` and `x-owner-passphrase`). It does not use the required Sociobot Microsoft Entra External ID authority `sociobotcustomers.ciamlogin.com`. The work order requires that a product requiring sign-in use that tenant and nothing else.

### High — mobile touch target below the 44 px requirement

At `/owner`, the **Read plan and billing terms** link measured 234×20 CSS px at a 390 px viewport. The required minimum touch target is 44×44 px. All other checked controls met the requirement.

### High — Lighthouse mobile performance threshold missed

Fresh Lighthouse mobile results for the live landing page: Performance **88** (required ≥90), Accessibility **100**, LCP 1955.62 ms, CLS 0, FCP 1211.62 ms, and Total Blocking Time 451 ms. Lighthouse also reported an image-delivery opportunity estimated at 85 kB. The performance threshold is mandatory.

## Environment note

The Docker CLI is not installed in this verification container, so a local container-image build could not be run. The repository production frontend build and Rust release build passed, and the live container reported the exact candidate build SHA. No product code was changed during verification.

## Recommended next steps

1. Replace the owner passphrase sign-in flow with the required Sociobot Microsoft Entra External ID tenant integration.
2. Give the `/owner` terms link a 44 px minimum height.
3. Reduce the measured mobile blocking/image-delivery costs and rerun Lighthouse until performance is at least 90.
