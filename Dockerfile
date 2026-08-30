FROM node:22-alpine AS web
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY index.html vite.config.ts ./
COPY src ./src
COPY public ./public
RUN npm run build

FROM rust:1-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends build-essential pkg-config libsqlite3-dev && rm -rf /var/lib/apt/lists/*
COPY backend/Cargo.toml backend/Cargo.lock* ./backend/
WORKDIR /app/backend
RUN mkdir src && printf 'fn main() {}' > src/main.rs && cargo build --release && rm -rf src
COPY backend/src ./src
# COPY preserves source mtimes. Refresh the entry point so Cargo cannot retain
# the dependency-cache stage's dummy binary when the real source is older.
RUN touch src/main.rs && cargo build --release

FROM debian:bookworm-slim
ARG BUILD_SHA=dev
ENV BUILD_SHA=$BUILD_SHA PORT=8080 DATA_DIR=/data
RUN groupadd --system catalog && useradd --system --gid catalog --home-dir /app catalog && mkdir -p /data /app/dist && chown -R catalog:catalog /data /app
COPY --from=builder /app/backend/target/release/client-request-catalog-server /app/server
COPY --from=web /app/dist /app/dist
USER catalog
WORKDIR /app
EXPOSE 8080
ENTRYPOINT ["/app/server"]
