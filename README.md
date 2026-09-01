# Client Request Catalog

A private, quote-first catalog for a small service or goods business. Owners
create opaque, expiring links for known clients and choose exactly which offers
each link can open. Submitted requests appear in the owner inbox. Owners can
export one request as CSV, or delete one request without exposing other clients.

This is for small operators who currently collect repeat requests through
email, messages, or a PDF price list.

## Run locally

Requirements: Node 22+ and Rust 1.88+.

```sh
npm ci
npm run build
cargo run --manifest-path backend/Cargo.toml
```

Open `http://localhost:8080/demo` for the isolated sample. Open `/owner` to
create a real client link. The first startup creates a SQLite database and a
strong owner code in `/data/owner-code.txt` (or under `DATA_DIR` when set).
Do not share the owner code with clients. `PORT`, `DATA_DIR`, and `OWNER_CODE`
are optional overrides.

Repaired deployments store active data in `/data/catalog-live.sqlite`. The
adjacent `catalog-live.ready` marker is written only after first initialization.
Zero-byte database files from rejected rollout attempts remain untouched.

## Verify

```sh
npm test
cargo test --manifest-path backend/Cargo.toml
npm run check
npm run test:e2e
npm run build
```

`npm run build` writes the frontend to `dist/`. Browser tests start a temporary
SQLite server and run every claim from `.factory/claims.json`. They cover the
demo sandbox, opaque client-link lifecycle, request delivery, exports,
same-origin privacy, light and dark accessibility, mobile, keyboard, offline
errors, metadata, response headers, rate limits, and 404 behavior.

## Deploy

The root `Dockerfile` is a multi-stage container build. It compiles the Vite
frontend and Rust service, runs as a non-root user, and serves both on `PORT`
(default `8080`). It accepts the factory `BUILD_SHA` build argument and exposes
`/health`. Persist `/data` in deployment so the catalog database and generated
owner code survive restarts.

## Privacy and billing

The landing and demo flows have no third-party runtime scripts, remote fonts,
analytics, or trackers. The demo does not read or write SQLite. A real request
stores the submitted contact details, selected offers, and note. Owners can
export or delete one request from the inbox. Deletion leaves only an internal
request ID, action, and date in the audit record. See `/privacy` and `/terms`
in the app.
