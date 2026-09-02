# Client Request Catalog — adversarial review 1 handoff

## Result

**FAIL — 23 findings: 4 blocking, 10 major, and 9 minor.**

The complete report is in `.factory/review-1.md`. Product code was not
modified. The pre-existing modified `graphify-out` files were left untouched.

## What was reviewed

- Cold live landing page at 390 × 844 and 1440 × 900.
- Every landing-page and README sentence, with word counts.
- One-click demo entry, sample submission, reset, storage namespaces, and live
  request origins.
- Every `.factory/claims.json` command from a separate clean clone.
- Prior handoff and the previously repaired browser-history focus behavior.
- Titles, descriptions, canonicals, OG/Twitter data, icons, H1/heading
  structure, 404, deep links, Back/Forward focus, link crawl, headers,
  responsive layout, reduced motion, and visual identity.
- Accessibility with the fleet URL verifier and Playwright axe integration.
- Missed leverage and unnecessary-AI/key checks.

## Verification performed

```sh
npm ci
npm test
npm run check
npm run build
cargo test --locked --manifest-path backend/Cargo.toml
npm run test:e2e -- --grep @claim:<each-id>
```

Results: 12/12 registered claim commands exited successfully, unit tests were
1/1, Rust tests were 11/11, typecheck/lint/build passed, and `dist/` was
produced. The live URL verifier passed. Playwright axe found zero serious or
critical issues on all public routes checked.

## What remains

The four blockers are: no owner-facing sandbox demo; expiration is not tested
by `private-prices`; exports are tested without a request row; and offers
cannot be edited, archived, or removed. The report also records unlisted
claims, missing connection/price facts, missing CSV offer import, terminology
and sentence-length issues, a vague demo action/heading, and stale `og:url`
metadata on non-home routes. Private-catalog titles can also exceed the title
limit and omit the product name.

No deployment or infrastructure action was taken.
