# Client Request Catalog — independent QA handoff

## Outcome

**FAIL — do not release.**

Candidate `cf2bf3ce8d3e07e52688f21e42b5103e6a6caa84` was checked locally from a
clean clone and live at `https://client-request-catalog.sociobot.in` on
2026-09-01 UTC. The live `/health` identity and static assets match the
candidate.

The required details and reproduction evidence are in
`.factory/verification-3.md`.

## Release blockers

- A normal hosted business has no real setup path. **Start for real** returns
  to the landing page, while the owner workspace requires a code stored in the
  server's `/data/owner-code.txt` file.
- Real owner and client views are hard-coded as **Field & Form**. There is no
  setting for the business identity, so the brief's branded real catalog
  cannot be created without source changes.
- The privacy statement that deletion retains only internal request ID,
  action, and date is not listed in `.factory/claims.json`, and its tagged
  claim test does not check those retained fields.

The shared rate limiter works live, but write and owner-authentication routes
use the same burst-40, 20-per-second allowance as reads instead of the stricter
policy required by the backend contract. The researched subscription path is
also absent.

## What passed

- All eight listed claim commands.
- `npm ci`, `npm test`, `npm run check`, `npm run build`.
- Rust formatting, 8 Rust tests, and the locked release build.
- All 13 Playwright tests.
- Fresh-database normal, boundary, invalid-input, recovery, export, deletion,
  40-write concurrency, graceful restart, persisted owner-code, and persisted
  SQLite checks.
- Live desktop and 390 px mobile checks, keyboard focus, reduced motion, light
  and dark axe scans, request logging, console/page errors, headers, caching,
  routes, metadata, and build identity.
- Live allowance check: 251 of 300 concurrent requests returned 429, each with
  `Retry-After: 1`; 49 completed while the token bucket refilled.
- Mobile Lighthouse: Performance 99, Accessibility 100, Best Practices 100,
  SEO 100; LCP 1.9 s, TBT 0 ms, CLS 0, 168 KiB transferred.

The exact container image could not be built locally because this verifier has
no Docker or Podman executable. The candidate's locked release backend build
passed, the Dockerfile contract was inspected, and the matching live build is
healthy.

## Re-run after repair

```sh
npm ci
node -e "for (const c of require('./.factory/claims.json')) console.log(c.test)"
# Run every printed claim command separately.
npm test
npm run check
npm run build
cargo fmt --manifest-path backend/Cargo.toml -- --check
cargo test --manifest-path backend/Cargo.toml
cargo build --release --locked --manifest-path backend/Cargo.toml
npm run test:e2e
```

No product code was changed during this verification.
