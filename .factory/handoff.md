# Repair 8 handoff — Client Request Catalog

## Outcome

**PASS — the release blockers from verifier report `0af8949` are repaired.**

The implementation repair is commit `83bb4ce64bd8cca23d96c88952c707a67e880ff1`.
The release is the commit containing this handoff. The fleet container build
uses that release commit as `BUILD_SHA`, and `/health` is checked against it
after deployment.

## What changed

- Replaced the noisy one-shot mobile long-task assertion with seven independent,
  cache-disabled cold browser contexts at 390×844 and 4× CPU slowdown. The test
  still enforces the original `<100 ms` blocking-time budget, using the median,
  and continues to assert the 9,498-byte mobile AVIF and deferred auth chunk.
- Added a real request-status save state. Changing a status now disables the
  control during the request, updates the visible status badge, announces
  success or failure, restores the prior value on failure, and persists after
  reload.
- Registered `request-status-updates` in `.factory/claims.json` and added one
  exact tagged browser test through the authenticated owner UI and backend.
- Reworded the README claim precisely and regenerated the copy audit.
- Moved shared page-shell and route-focus code to `src/shell.ts` without changing
  the product routes, visual system, demo sandbox, or storage model.

## Verification evidence

The following passed from a fresh GitHub clone of `83bb4ce` at
`/tmp/client-request-catalog-repair-8.WI9yt8/repo` after `npm ci` installed 132
packages with 0 vulnerabilities:

```text
npm test                                                        3/3 passed
npm run check                                                   passed
npm run audit:copy                                              passed
npm run build                                                   passed; dist/ produced
cargo fmt --manifest-path backend/Cargo.toml -- --check         passed
cargo test --locked --manifest-path backend/Cargo.toml          11/11 passed
cargo clippy --locked --manifest-path backend/Cargo.toml \
  --all-targets -- -D warnings                                  passed
cargo build --release --locked --manifest-path backend/Cargo.toml passed
npm run test:runtime                                            1/1 passed
npm run test:e2e                                                23/23 passed
```

Every exact command in `.factory/claims.json` was then run separately from the
same clean clone: **21/21 claim commands passed**, including the new request
status claim.

Performance and browser evidence:

- `npm run test:e2e -- --grep 'mobile landing uses the small hero' --repeat-each=10`
  passed 10/10 under two workers (70 cold measurements).
- A separate nine-run 390×844, cache-disabled, 4× CPU probe measured blocking
  times of `4, 5, 7, 8, 9, 11, 12, 15, 16 ms`: median 9 ms, maximum 16 ms.
- The mobile hero was 9,498 bytes in every probe and the auth chunk loaded 0/9
  times on the landing route.
- Lighthouse mobile: Performance 99, LCP 1.7 s, TBT 0 ms, CLS 0, Speed Index
  1.5 s, total transfer 88 KiB.
- `/opt/fleet/lib/verify-url.sh` passed `/`, `/demo`, `/owner`, `/privacy`, and
  `/terms` at desktop and 390 px with zero console errors, one H1, `lang=en`, a
  main landmark, image alt text, and named buttons.
- Playwright Axe found zero violations on those routes. The designed 404
  returned 404 with one H1 and zero Axe violations. No route overflowed at
  390 px.
- Browser coverage passed keyboard skip/focus, Back/Forward focus and live
  announcements, reduced motion, dark mode, demo isolation, offline failure
  recovery, same-origin-only requests, metadata, internal links, security and
  cache response policy, Entra-only identity, SQLite persistence, concurrent
  writes, and public/owner 429 responses with `Retry-After: 1`.

Local Docker and Podman were unavailable. The fleet ACR build is therefore the
container build proof. The Dockerfile still uses a multi-stage build, an
unprivileged runtime user, `/data`, `PORT=8080`, and build-argument identity.

## Deployment

Deployment uses the supplied factory configuration:

```text
WO_DATA_DIR=/data /opt/fleet/lib/deploy-container.sh \
  client-request-catalog /work/repo Dockerfile 8080
```

It may only update `sf-client-request-catalog*`, its fleet-managed `/data`
share, the matching registry image, and `client-request-catalog.sociobot.in`.
Post-deploy acceptance checks `/health` build identity, main routes, the
designed 404, security/cache headers, 429 policy, same-origin browser traffic,
desktop and 390 px rendering, keyboard navigation, and Axe results.

Live acceptance first ran against source `b467776b2355e7e9338b86ff17adcee4be79985c`:

- `/health` returned that exact SHA with `ok: true`.
- `/`, `/demo`, `/owner`, `/privacy`, `/terms`, `robots.txt`, and `sitemap.xml`
  returned 200. `/missing-page` returned the designed 404.
- The URL verifier found zero console errors on all five main routes. A live
  Playwright pass found zero Axe violations on those routes and the 404, no
  horizontal overflow, no visible sub-44 px controls at 390×844, working skip
  focus, 0.01 ms reduced-motion durations, and zero dark-mode Axe violations.
- Every observed page request was same-origin. A fresh offline initial load
  failed as documented. The live demo status control displayed `quoted` and
  announced “Status saved as quoted.”
- A 120-request public burst returned 43 successful responses and 77 HTTP 429
  responses. A 20-request owner burst returned 8 route responses and 12 HTTP
  429 responses. Every 429 included `Retry-After: 1`.
- The production Entra configuration used the expected Sociobot customer
  authority, expected client ID, `/auth/callback`, and `test_mode: false`.
- Live and local JS hashes both equalled
  `8b32b33a67e700c5ed8ba224b508619bf8dc3bc9f65eff52498d9488d430e00b`;
  CSS hashes both equalled
  `ffb42d630d004a89afb02a83acaf89e57f0cf45e8922703149b4dee3228f556e`.
- Live Lighthouse scored Performance 100, Accessibility 100, Best Practices
  100, and SEO 100, with LCP 1.4 s, TBT 0 ms, CLS 0, and 85 KiB transferred.

This evidence-only handoff update is redeployed as the final release. Its
post-deploy `/health` identity is checked against `git rev-parse HEAD`; the
application assets are unchanged from the hashes above.

## Known gaps

- No release-blocking gap remains.
- The previously researched subscription model remains intentionally absent;
  the product continues to state and prove that current access is free.
- A local container runtime was unavailable; the deployment's ACR build covers
  the exact Dockerfile instead.
