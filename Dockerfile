FROM node:22-alpine AS web
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY index.html vite.config.ts ./
COPY src ./src
COPY public ./public
RUN npm run build

# Cargo.lock resolves ICU 2.3, which has an MSRV of Rust 1.88. Keep this
# builder in step with the lockfile so the ACR build is reproducible.
FROM rust:1.88-alpine AS builder
WORKDIR /app
RUN apk add --no-cache musl-dev pkgconfig
COPY backend/Cargo.toml backend/Cargo.lock* ./backend/
WORKDIR /app/backend
RUN mkdir src && printf 'fn main() {}' > src/main.rs && cargo build --release && rm -rf src
COPY backend/src ./src
RUN cargo build --release

FROM alpine:3.22
ARG BUILD_SHA=dev
ENV BUILD_SHA=$BUILD_SHA PORT=8080 DATA_DIR=/data
RUN addgroup -S catalog && adduser -S catalog -G catalog && mkdir -p /data /app/dist && chown -R catalog:catalog /data /app
COPY --from=builder /app/backend/target/release/client-request-catalog-server /app/server
COPY --from=web /app/dist /app/dist
USER catalog
WORKDIR /app
EXPOSE 8080
ENTRYPOINT ["/app/server"]
