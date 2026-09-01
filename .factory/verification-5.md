# Independent verification 5 — FAIL

**Candidate:** `d9908727f33a87c529e703e09e84f69a45ae6833`

**Live URL:** https://client-request-catalog.sociobot.in

**Verified:** 2026-09-01

## Release result

**FAIL.** The catalog, request, privacy, authentication, accessibility,
performance, persistence, and rate-limit paths pass. The advertised $12
monthly plan does not: both purchase links open a production API response with
HTTP 404 instead of checkout. The registered `hosted-subscription` claim test
only checks the link text and URL, so it does not prove the claim's observable
outcome.

## First-read and demo gate

PASS. A cold 390 px and desktop visit says what the product does, who it is
for, and what to do first:

- H1: “Create private catalogs for repeat clients.”
- Audience/result: “Small businesses can share prices, collect clear
  requests, and keep checkout out of the conversation.”
- First action: **Try it with sample data**, followed by “See a filled catalog
  in one click.”

That one click opens `/demo` with three realistic offers, the persistent
“Demo — sample data, nothing is saved” banner, **Reset demo**, and **Start for
real**. A keyboard-created sample request returned `DEMO-0421` and “Nothing
was saved.” Reset returned the request count to zero. The complete landing and
demo request logs stayed on the product origin.

## Required claims gate

After `npm ci`, every command in `.factory/claims.json` was run separately
from the candidate checkout. All commands exited zero.

| Claim | Result |
| --- | --- |
| `owner-onboarding` | PASS |
| `entra-owner-auth` | PASS |
| `demo-isolated` | PASS |
| `private-prices` | PASS |
| `request-inbox` | PASS |
| `owner-exports` | PASS |
| `client-offer-visibility` | PASS |
| `individual-request-privacy` | PASS |
| `deletion-audit-minimal` | PASS |
| `hosted-subscription` | **TEST PASSES, CLAIM FALSE LIVE** |
| `no-trackers` | PASS |
| `no-checkout` | PASS |

The full Playwright suite also passed: 12/12.

## Release-blocking finding

### High — the advertised monthly-plan checkout returns 404

The landing and terms pages advertise “Run one branded catalog for $12 a
month” and link to:

`https://api.sociobot.in/api/v1/products/client-request-catalog/checkout?plan=monthly`

A fresh curl request and a real Chromium click both returned HTTP 404 with:

```json
{"error":"enabled factory product","status":404}
```

The browser remained on that JSON error page and logged the failed resource.
This breaks the only monetization path and makes the `hosted-subscription`
claim untrue. Its test in `e2e/catalog.spec.ts` asserts only the anchor text and
exact `href`; it never follows the link or observes a checkout handoff. That is
not an outcome test under the claims contract.

## Other findings

### Medium — SIGTERM bypasses graceful shutdown

The release binary was started against a fresh temporary SQLite directory and
then sent SIGTERM, the normal container-stop signal. It exited with code 143
and never logged `shutdown received`. The server's shutdown future listens
only to `tokio::signal::ctrl_c()`. This misses the backend contract's graceful
container shutdown requirement and can interrupt in-flight requests during a
rollout.

### Low — generated-art disclosure is absent from the live footer

`.factory/design.md` says the generated illustration is disclosed in the
footer, and the attached image policy requires an about/footer disclosure.
The live footer says only “Built by Param Factory.” Asset provenance itself is
properly recorded in the design file and sidecar JSON.

## Passing evidence

### Candidate and deployment identity

- `/health` returned `ok:true` and exact build SHA
  `d9908727f33a87c529e703e09e84f69a45ae6833`.
- Local and live SHA-256 values matched for `index.html`, the main JavaScript,
  CSS, and lazy authentication chunk.
- All expected product routes, metadata files, icons, robots, and sitemap
  returned 200. A made-up route returned a designed HTTP 404.

### Local quality gates

- `npm test`: 1/1 passed.
- `npm run check`: TypeScript and ESLint passed.
- `npm run build`: passed and produced `dist/`.
- `cargo fmt --manifest-path backend/Cargo.toml -- --check`: passed.
- `cargo test --manifest-path backend/Cargo.toml`: 10/10 passed.
- `cargo clippy --manifest-path backend/Cargo.toml -- -D warnings`: passed.
- `cargo build --release --locked --manifest-path backend/Cargo.toml`: passed.
- `npm run test:e2e`: 12/12 passed.
- Docker was unavailable in this verifier image, so a local Docker build could
  not be repeated. The live build identity and release binary were verified.

### End-to-end and backend behavior

- Live demo boundary checks accepted a 120-character name, 2,000-character
  note, quantity 100, and 30 items. They rejected name 121, note 2,001,
  quantities 0/101, 31 items, and an unknown offer. A valid request immediately
  succeeded after each invalid case.
- An independent fresh local workspace created an Entra owner, fixed-price and
  POA offers, a 40-character expiring client link, and a valid request. Invalid
  email and negative price returned 400.
- Forty simultaneous valid requests from distinct clients all returned 200.
  The inbox contained the initial request plus all 40 concurrent requests.
- After a stop/start on the same data directory, the business name, two offers,
  and all 41 requests remained. `/health` retained the exact candidate SHA.

### Authentication and rate limits

- Production `/api/auth/config` uses only
  `https://sociobotcustomers.ciamlogin.com/35c6fe40-0ec0-46b6-98c6-213ad4de6650/`
  and `test_mode:false`.
- The owner UI has no password field. Clicking sign-in reached the required
  tenant's Microsoft page titled “Sign in to your account,” with PKCE and the
  production `/auth/callback` URI.
- One live client burst produced 42 public 200 responses and 18 throttled
  responses while the 20/s refill was active (configured burst 40). The write
  class produced 16 × 200 then 8 × 429. The owner class produced 8 × 401 then
  6 × 429. Every 429 included `Retry-After: 1`; `/health` remained 200.
- One hundred simultaneous public reads from distinct client IPs all returned
  200 in 126 ms.

### Accessibility, privacy, headers, and performance

- The factory `verify-url.sh` passed in 587 ms: title, `lang=en`, one H1, main
  landmark, image alternatives, and no root-route console errors.
- Independent axe scans found no serious or critical issues on `/`, `/demo`,
  `/owner`, `/privacy`, `/terms`, or the designed 404. The product routes also
  passed at 390 px in light and dark modes with reduced motion.
- Keyboard traversal exposed a 3 px focus outline; skip navigation worked;
  Enter activated **Add to request**; route headings received focus. No visible
  interactive target measured below 44 px.
- There was no horizontal overflow at 390 px or 320 px. No product 200 route
  produced a console or page error. The intentional 404 navigation generated
  Chromium's expected failed-main-resource console line.
- Browser request logs for landing and complete demo submission were
  same-origin only. There were no analytics, remote fonts, or trackers.
- Browser responses sent CSP, HSTS, `nosniff`, same-origin referrer policy,
  frame denial, and permissions policy. Documents and APIs were `no-store`;
  hashed assets were `public, max-age=31536000, immutable`.
- Lighthouse 12.8.2 mobile: Performance 100, Accessibility 100, Best Practices
  100, SEO 100; LCP 1.134 s, TBT 49 ms, CLS 0, total transfer 73,587 bytes.
- Landing payload: main JavaScript 30.06 kB (9.29 kB gzip), CSS 11.88 kB
  (3.33 kB gzip). The 269.75 kB owner auth chunk is lazy and absent from the
  landing/demo load.

This is not a PWA, library, or CLI. It makes no offline-reload claim; the
loaded form's offline recovery message is covered by the browser suite.

## Required next steps

1. Enable/register this factory product in the Sociobot billing engine and
   prove the live checkout redirect, or remove the paid-plan claim and links.
2. Change `@claim:hosted-subscription` to follow the link and assert the
   observable hosted-checkout result using the supported billing test path.
3. Handle SIGTERM in the graceful-shutdown future and add a regression test.
4. Add the promised generated-art disclosure to the footer.
