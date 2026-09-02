# Review 3 handoff — Client Request Catalog

## Outcome

**FAIL — 3 blocking claim-proof findings.**

The live product is clear, tryable, isolated, and structurally sound, but three
registered tests do not assert their complete claim text. No product code or
live data was changed. The full review is in `.factory/review-3.md`.

## Findings to address

- F-3-1: test transitions to `quoted`, `closed`, and back to `new`.
- F-3-2: prove an individual export excludes every field from a second client.
- F-3-3: prove demo mutations do not enter persistent browser stores and vanish
  on reload.

## Verification performed

From clean clone `/tmp/crc-review3-clean.x7aFRy/repo`:

```sh
npm ci
# Every exact command in .factory/claims.json, run separately
npm test
npm run check
npm run audit:copy
cargo fmt --manifest-path backend/Cargo.toml -- --check
cargo test --locked --manifest-path backend/Cargo.toml
cargo clippy --locked --manifest-path backend/Cargo.toml --all-targets -- -D warnings
npm run test:e2e
```

All commands exited successfully: 21/21 registered claim commands, 3/3 Node
tests, 11/11 Rust tests, and 23/23 Playwright tests. The findings concern
missing assertions inside three green claim tests.

Live verification covered cold 390 px and desktop first reads, one-click demo
entry, sample submission and reset, browser storage, request origins, valid PDF
parsing, route metadata, link crawling, Back/Forward focus, offline behavior,
light/dark Axe scans, security headers, and `/opt/fleet/lib/verify-url.sh` on all
five real routes. `/health` reported deployed build
`c8aff8d0ff0da15271acd4462738224748bd4e52`.

## Known gaps and next step

`.factory/brief.json` is absent, so scope was verified against the contract,
design, claims, README, UI, and implementation. Repair only the three claim
tests above, then rerun every claim command from a clean clone and perform the
same live checklist after deployment.
