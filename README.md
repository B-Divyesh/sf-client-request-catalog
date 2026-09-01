# Client Request Catalog

Client Request Catalog is for small service and goods businesses that share private prices with repeat clients. An owner creates a branded catalog, chooses the offers on each opaque client link, and receives quote requests in one inbox.

Open /demo for a one-click isolated sample. Open /owner to create the first owner workspace. The first business chooses its own name and owner passphrase in the browser; the server stores only an Argon2 password hash in SQLite. There is no server-file owner code.

## Run

    npm ci
    npm run build
    cargo run --manifest-path backend/Cargo.toml

The service runs on PORT (default 8080) with no required environment variables. It writes SQLite state to /data/catalog-live.sqlite by default, or DATA_DIR when set. Persist /data in deployment.

## Verify

    npm test
    npm run check
    npm run build
    cargo fmt --manifest-path backend/Cargo.toml -- --check
    cargo test --manifest-path backend/Cargo.toml
    npm run test:e2e

Every visitor-facing statement is registered in .factory/claims.json. The browser suite covers first-run ownership and branding, the demo sandbox, request privacy, individual export/deletion and minimal audit fields, opaque links, exports, the billing handoff, accessibility, mobile, keyboard, offline failure handling, metadata, headers, and rate limits.

## Privacy and billing

The demo is non-persistent. Real requests store submitted contact details and selected offers so the business can reply. Owners can export or delete one request. Deletion retains only an internal request ID, action, and date.

The hosted catalog plan is $12 per month. The product links to the hosted Sociobot checkout; Sociobot is the merchant of record and handles subscription billing and receipts. The request flow itself never starts checkout or charges a client.
