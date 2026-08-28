# Client Request Catalog

A private, quote-first request surface for a small service or goods business.
It gives known clients an expiring link where they can select fixed-price,
price-on-application, or repeat-order items without turning the business into
an ecommerce shop. The owner gets a request inbox, status controls, CSV/PDF
export, and deletion controls.

This is for small operators who currently collect repeat requests through
email, messages, or a PDF price list.

## Run locally

Requirements: Node 22+ and Rust 1.85+.

```sh
npm install
npm run build
cargo run --manifest-path backend/Cargo.toml
```

Open `http://localhost:8080/?client=demo-client`. The first startup creates a
SQLite database and a strong owner code in `/data/owner-code.txt` (or under
`DATA_DIR` if set). Open `/owner` and enter that code. Do not share it with
clients. The service works with no configuration beyond `PORT`; `DATA_DIR` and
`OWNER_CODE` are optional overrides.

## Verify

```sh
npm test
cargo test --manifest-path backend/Cargo.toml
npm run test:e2e
npm run build
```

`npm run build` writes the frontend to `dist/`. The browser test starts a
temporary SQLite-backed server, checks serious/critical accessibility issues
with axe, and submits a real request.

## Deploy

The root `Dockerfile` is a multi-stage container build. It compiles the Vite
frontend and Rust service, runs as a non-root user, and serves both on `PORT`
(default `8080`). It accepts the factory `BUILD_SHA` build argument and exposes
`/health`. Persist `/data` in deployment so the catalog database and generated
owner code survive restarts.

## Privacy and billing

There are no third-party runtime scripts, remote fonts, or analytics. A client
request stores only the contact details and note they submit; owners can export
or delete request data. See `/privacy` and `/terms` in the app.

Catalog Plus uses the Sociobot license flow. The app never embeds a payment
processor: it links to hosted Sociobot checkout, locally stores a returned
license token, verifies it at most daily, and offers license restoration.
