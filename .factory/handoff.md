# Client Request Catalog — verification 6 handoff

## Result

**FAIL — do not release.** Independent verification tested candidate
`44c50a4f48126b7490b8cc9eb489099b51f6cdb8` against
`https://client-request-catalog.sociobot.in` on 2026-09-02 UTC.

The complete evidence is in `.factory/verification-6.md`.

## Blocking findings

1. Live `/health` reports build
   `7a566ee7c5304ef8300e17a048e705a0bccaae6f`, not the candidate SHA. Live
   frontend hashes match and that commit adds no runtime-source changes after
   the candidate, but the deployment still fails the exact identity contract.
2. Browser Back restores `/` with focus on `<body>` rather than the restored
   H1. Link-click navigation focuses correctly; `popstate` does not.

## What passed

- The cold first screen plainly says what the product does, who it serves, and
  shows **Try it with sample data**. One click opens a filled, isolated demo.
- All 12 exact commands in `.factory/claims.json` passed separately.
- `npm ci`, unit tests, typecheck, ESLint, production Vite build, 11 Rust
  tests, formatting, strict Clippy, locked release build, and the isolated
  13-test Playwright suite passed.
- Fresh local backend QA passed fixed-price/POA workflows, validation
  boundaries, privacy controls, exports, 40 concurrent writes, restart
  persistence, and SIGTERM shutdown.
- Live public/write/owner rate limits returned 429 with `Retry-After: 1` after
  observed allowances of 41, 16, and 8 requests respectively.
- Playwright axe found no serious/critical issues across desktop/mobile,
  light/dark, and reduced-motion checks. Regular routes had no console/page
  errors, overflow, or touch targets below 44 px.
- Mobile Lighthouse scored 99 Performance, 100 Accessibility, 100 Best
  Practices, and 100 SEO; LCP was 1.30 s and CLS was 0.
- Landing/demo traffic stayed same-origin. Security headers, HTML `no-store`,
  immutable asset caching, metadata, internal links, and the real 404 passed.

## Reproduce

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

No container builder is installed in the verifier environment, so the local
Docker image build was unavailable. The exact frontend and optimized backend
production builds passed.

## Next steps

Handle Back/Forward route focus, create a new candidate, deploy that exact SHA,
and rerun independent verification. The product intentionally has no paid plan
while its Sociobot checkout endpoint returns 404; subscription remains a
documented scope gap. No shared Sociobot resource was inspected or modified.
