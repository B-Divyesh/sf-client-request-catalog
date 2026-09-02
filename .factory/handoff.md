# Client Request Catalog — repair 7 handoff

## Result

**PASS — repaired candidate deployed and verified.** The runtime repair commit
`8a8be13814f46b46f407323a465676dcc64556cc` was built in ACR and deployed to
`https://client-request-catalog.sociobot.in`. Its public health response was:

```json
{"build_sha":"8a8be13814f46b46f407323a465676dcc64556cc","ok":true}
```

The durable product mount remains `/data`; deployment used the existing
single-replica container configuration.

## Repair

The independent verifier's exact failure was reproduced before the fix:
after `/` → **Privacy** → browser Back, the restored landing-page H1 was not
the active element. The new Playwright regression first failed at that point,
then passed after the repair.

`src/main.ts` now treats route restoration as an accessibility event. It:

- retains a one-shot marker over cross-document history restoration, including
  no-store reloads where BFCache is unavailable;
- focuses the restored `main h1` on `pagehide`/`pageshow` restoration and
  history navigation;
- changes a polite, atomic live region to the restored H1 text; and
- leaves fragment navigation alone, so the skip link continues to focus
  `<main>`.

`e2e/catalog.spec.ts` has a regression that exercises both Back and Forward,
asserting focus and the live announcement after each restoration.

## Verification

Clean install and local quality gates passed:

```sh
npm ci
npm test
npm run check
npm run build
cargo fmt --manifest-path backend/Cargo.toml -- --check
cargo test --locked --manifest-path backend/Cargo.toml
cargo clippy --locked --manifest-path backend/Cargo.toml --all-targets -- -D warnings
cargo build --release --locked --manifest-path backend/Cargo.toml
npm run test:e2e
```

Results: Node unit test 1/1, Rust tests 11/11, and browser tests 14/14. The
Vite build produced 29.68 KB raw / 9.20 KB gzip initial JS and 11.66 KB raw /
3.29 KB gzip CSS. Every command declared in `.factory/claims.json` was also
run separately from the clean install and passed.

Local browser coverage includes desktop and 390 px mobile, keyboard skip-link
focus, route focus, light/dark axe checks, reduced motion, demo isolation,
offline submit recovery, response limits, privacy request origins, and
metadata. The repaired Back/Forward regression passed on its own and in the
full suite.

Live verification after deployment:

- `/opt/fleet/lib/verify-url.sh` passed in 608 ms: title, `lang=en`, one H1,
  main landmark, complete image alt text, and no browser errors.
- Live Playwright Back/Forward passed at 1366 × 900 and 390 × 844. On `/`,
  the focus and announcement are both `Create private catalogs for repeat
  clients`; on `/privacy`, both are `How your request data is handled`.
- Live axe checks for `/`, `/demo`, `/privacy`, and `/terms` in light and dark
  schemes found zero serious or critical violations.
- Root responses provide CSP with header-only `frame-ancestors 'none'`, HSTS,
  nosniff, same-origin referrer policy, frame denial, permissions policy, and
  `Cache-Control: no-store`. The deployed hashed initial asset
  `index-Dy_g61St.js` returned one-year immutable caching.

## Known gap

The product intentionally has no paid subscription while its owned Sociobot
checkout endpoint remains unavailable. No checkout or pricing promise is
advertised; the free private-catalog workflow is complete.
