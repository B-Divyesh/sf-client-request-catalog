# Client Request Catalog

Client Request Catalog is for small service and goods businesses that share private prices with repeat clients. An owner creates a branded catalog, chooses the offers on each opaque client link, and receives quote requests in one inbox.

Open /demo for a one-click isolated sample. Open /owner to create the first owner workspace. The first business signs in through the shared Sociobot Microsoft Entra External ID tenant, then chooses its catalog name. The server keys ownership by Entra's stable object ID. It stores no owner password.

## Run

    npm ci
    npm run build
    cargo run --manifest-path backend/Cargo.toml

The service runs on PORT (default 8080) with no required environment variables. It writes SQLite state to /data/catalog-live.sqlite by default, or DATA_DIR when set. Persist /data in deployment. Entra tenant and public client settings have safe Sociobot defaults and optional `ENTRA_TENANT_ID`, `ENTRA_TENANT_SUBDOMAIN`, and `ENTRA_CLIENT_ID` overrides.

## Deploy

Build the root Dockerfile and mount durable storage at `/data`:

    docker build --build-arg BUILD_SHA=$(git rev-parse HEAD) -t client-request-catalog .
    docker run --rm -p 8080:8080 -v client-request-catalog-data:/data client-request-catalog

The factory deployment uses the same container on port 8080 with one replica and its product-owned `/data` share.

## Verify

    npm test
    npm run check
    npm run build
    cargo fmt --manifest-path backend/Cargo.toml -- --check
    cargo test --manifest-path backend/Cargo.toml
    npm run test:e2e

Every visitor-facing statement is registered in .factory/claims.json. The browser suite covers Entra-only ownership and branding, the demo sandbox, request privacy, individual export/deletion and minimal audit fields, opaque links, exports, the billing handoff, accessibility, mobile, keyboard, image delivery, offline failure handling, metadata, headers, and rate limits.

## Privacy and billing

The demo is non-persistent. Real requests store submitted contact details and selected offers so the business can reply. Owners can export or delete one request. Deletion retains only an internal request ID, action, and date.

The hosted catalog plan is $12 per month. The product links to the hosted Sociobot checkout; Sociobot is the merchant of record and handles subscription billing and receipts. The request flow itself never starts checkout or charges a client.
