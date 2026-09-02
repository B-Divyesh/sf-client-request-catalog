# Client Request Catalog

Client Request Catalog helps small businesses share private prices and collect requests without checkout.

Open `/?demo=1` to try a sample owner workspace. It starts with three offers, two private client links, and three requests. Demo changes stay in browser memory and never enter the real inbox.

Open `/owner` to create the first owner workspace. Sociobot Microsoft Entra External ID is the only owner sign-in method. Owners can name the catalog, maintain offers, import CSV price sheets, and issue client links. They can review, update, export, or delete requests.

The product is free to use and requires an internet connection to load. One catalog can contain fixed prices and offers that need a quote.

## Run

    npm ci
    npm run build
    cargo run --manifest-path backend/Cargo.toml

`PORT` defaults to `8080`. Set `DATA_DIR` when local data should live somewhere other than `/data`. Mount `/data` on durable storage when deploying.

The default sign-in configuration points to Sociobot’s Entra tenant. Operators may set `ENTRA_TENANT_ID`, `ENTRA_TENANT_SUBDOMAIN`, and `ENTRA_CLIENT_ID` for another tenant.

## Deploy

Build the root Dockerfile and mount durable storage at `/data`:

    docker build --build-arg BUILD_SHA=$(git rev-parse HEAD) -t client-request-catalog .
    docker run --rm -p 8080:8080 -v client-request-catalog-data:/data client-request-catalog

## Verify

    npm test
    npm run check
    npm run build
    cargo fmt --manifest-path backend/Cargo.toml -- --check
    cargo test --locked --manifest-path backend/Cargo.toml
    npm run test:e2e

Every visitor-facing claim is registered in `.factory/claims.json`. The browser suite covers every registered claim. It also checks accessibility, routing, metadata, image delivery, offline behavior, and rate limits.

## Privacy

No product page loads analytics, advertising, remote fonts, or tracking scripts. Real requests store the submitted name, email, phone, reference, note, and selected offers.

Owners can export request rows as CSV or PDF. They can delete one request without exposing other clients. Deletion keeps only an internal request ID, action, and date.

Sending a request does not charge the client, reserve stock, or create a purchase. The footer discloses the original image generation with Azure AI Foundry.
