use axum::{
    extract::{Path, Request, State},
    http::{header, HeaderMap, HeaderValue, StatusCode},
    middleware::{self, Next},
    response::{Html, IntoResponse, Response},
    routing::{delete, get, post},
    Json, Router,
};
use chrono::{Duration, Utc};
use rand::{distributions::Alphanumeric, Rng};
use serde::{Deserialize, Serialize};
use sqlx::{
    sqlite::{SqliteConnectOptions, SqlitePoolOptions},
    FromRow, Sqlite, SqlitePool,
};
use std::str::FromStr;
use std::{
    collections::HashMap,
    env, fs,
    path::PathBuf,
    sync::{Arc, Mutex},
    time::{Duration as StdDuration, Instant},
};
use tower_http::{
    services::{ServeDir, ServeFile},
    trace::TraceLayer,
};
use tracing::info;

#[derive(Clone)]
struct AppState {
    db: SqlitePool,
    owner_code: Arc<String>,
    limiter: Arc<Mutex<HashMap<String, Window>>>,
    build_sha: String,
    not_found_html: Arc<String>,
}
struct Window {
    updated_at: Instant,
    tokens: f64,
}

const RATE_LIMIT_PER_SECOND: f64 = 20.0;
const RATE_LIMIT_BURST: f64 = 40.0;
#[derive(Serialize, FromRow)]
struct Product {
    id: i64,
    name: String,
    description: String,
    price_cents: Option<i64>,
    currency: String,
    stock_note: String,
    visible: bool,
}
#[derive(Serialize)]
struct Catalog {
    business_name: String,
    client_name: String,
    expires_at: String,
    products: Vec<Product>,
}
#[derive(Deserialize)]
struct ClientInput {
    name: String,
    expires_in_days: Option<i64>,
    offer_ids: Option<Vec<i64>>,
}
#[derive(Deserialize)]
struct OfferAssignmentInput {
    product_ids: Vec<i64>,
}
#[derive(Serialize)]
struct ClientLink {
    id: i64,
    name: String,
    token: String,
    expires_at: String,
    assigned_product_ids: Vec<i64>,
}
#[derive(FromRow)]
struct ClientLinkRow {
    id: i64,
    name: String,
    token: String,
    expires_at: String,
    assigned_product_ids: String,
}
#[derive(Deserialize)]
struct RequestInput {
    name: String,
    email: String,
    phone: Option<String>,
    reference: Option<String>,
    note: Option<String>,
    items: Vec<RequestItem>,
}
#[derive(Deserialize)]
struct RequestItem {
    product_id: i64,
    quantity: i64,
}
#[derive(Deserialize)]
struct ProductInput {
    name: String,
    description: String,
    price_cents: Option<String>,
    stock_note: Option<String>,
}
#[derive(Deserialize)]
struct StatusInput {
    status: String,
}
#[derive(Serialize, FromRow)]
struct InboxRow {
    id: i64,
    reference: String,
    name: String,
    email: String,
    note: Option<String>,
    status: String,
    created_at: String,
    items: String,
}
#[derive(Serialize)]
struct Overview {
    business_name: String,
    clients: Vec<ClientLink>,
    products: Vec<Product>,
    requests: Vec<InboxRow>,
    deletion_audit_count: i64,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .json()
        .with_env_filter(env::var("RUST_LOG").unwrap_or_else(|_| "info".into()))
        .init();
    let data_dir = env::var("DATA_DIR").unwrap_or_else(|_| "/data".into());
    fs::create_dir_all(&data_dir).expect("create data directory");
    let key_path = PathBuf::from(&data_dir).join("owner-code.txt");
    let (owner_code, generated) = match env::var("OWNER_CODE") {
        Ok(value) if value.len() >= 12 => (value, false),
        _ => match fs::read_to_string(&key_path) {
            Ok(value) => (value.trim().into(), false),
            Err(_) => {
                let generated: String = rand::thread_rng()
                    .sample_iter(&Alphanumeric)
                    .take(28)
                    .map(char::from)
                    .collect();
                fs::write(&key_path, &generated).expect("persist generated owner code");
                (generated, true)
            }
        },
    };
    // Rejected revisions left zero-byte SQLite files and hot journals on the
    // mounted share. Keep them untouched; use a clean, single-connection file.
    let db_path = PathBuf::from(&data_dir).join("catalog-live.sqlite");
    let ready_path = PathBuf::from(&data_dir).join("catalog-live.ready");
    let database_ready = ready_path.exists();
    if !database_ready {
        // A crash during first initialization can leave an empty file and hot
        // journal. No active data exists until the ready marker is written.
        for candidate in [
            db_path.clone(),
            PathBuf::from(format!("{}-journal", db_path.display())),
            PathBuf::from(format!("{}-wal", db_path.display())),
            PathBuf::from(format!("{}-shm", db_path.display())),
        ] {
            match fs::remove_file(candidate) {
                Ok(()) => {}
                Err(problem) if problem.kind() == std::io::ErrorKind::NotFound => {}
                Err(problem) => panic!("clear incomplete database: {problem}"),
            }
        }
        let lock_dir = PathBuf::from(format!("{}.lock", db_path.display()));
        match fs::remove_dir_all(lock_dir) {
            Ok(()) => {}
            Err(problem) if problem.kind() == std::io::ErrorKind::NotFound => {}
            Err(problem) => panic!("clear incomplete database lock: {problem}"),
        }
    }
    let db = open_db(&db_path).await.expect("open sqlite");
    if !database_ready {
        init_db(&db).await.expect("initialize database");
        fs::write(&ready_path, b"ready\n").expect("mark database initialized");
    }
    migrate_db(&db)
        .await
        .expect("apply compatible database migrations");
    let state = AppState {
        db: db.clone(),
        owner_code: Arc::new(owner_code),
        limiter: Arc::new(Mutex::new(HashMap::new())),
        build_sha: env::var("BUILD_SHA").unwrap_or_else(|_| "dev".into()),
        not_found_html: Arc::new(String::new()),
    };
    info!(
        generated_owner_code = generated,
        supplied_owner_code = env::var("OWNER_CODE").is_ok(),
        "runtime configuration ready; owner code is persisted under data directory (never printed)"
    );
    let app = app(state, PathBuf::from("dist"));
    let port = env::var("PORT")
        .ok()
        .and_then(|x| x.parse().ok())
        .unwrap_or(8080);
    let listener = tokio::net::TcpListener::bind(("0.0.0.0", port))
        .await
        .expect("bind port");
    info!(port, "client request catalog listening");
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown())
        .await
        .expect("serve");
}

fn app(mut state: AppState, dist_dir: PathBuf) -> Router {
    let index = dist_dir.join("index.html");
    state.not_found_html = Arc::new(fs::read_to_string(&index).unwrap_or_else(|_| {
        "<!doctype html><html lang=\"en\"><title>Page not found — Client Request Catalog</title><main><h1>Page not found</h1><p><a href=\"/\">Return home</a></p></main></html>".into()
    }));
    Router::new()
        .route("/health", get(health))
        .route("/api/demo/catalog", get(get_demo_catalog))
        .route("/api/demo/requests", post(create_demo_request))
        .route("/api/catalog/:token", get(get_catalog))
        .route("/api/catalog/:token/requests", post(create_request))
        .route("/api/admin/overview", get(overview))
        .route("/api/admin/clients", post(create_client))
        .route(
            "/api/admin/clients/:id",
            delete(revoke_client).patch(set_client_offers),
        )
        .route("/api/admin/products", post(create_product))
        .route("/api/admin/requests", delete(delete_requests))
        .route(
            "/api/admin/requests/:id",
            get(export_single_csv)
                .patch(update_status)
                .delete(delete_request),
        )
        .route("/api/admin/requests.csv", get(export_csv))
        .route("/api/admin/requests.pdf", get(export_pdf))
        .route_service("/", ServeFile::new(&index))
        .route_service("/demo", ServeFile::new(&index))
        .route_service("/owner", ServeFile::new(&index))
        .route_service("/privacy", ServeFile::new(&index))
        .route_service("/terms", ServeFile::new(&index))
        .route_service("/404.html", ServeFile::new(&index))
        .route_service("/robots.txt", ServeFile::new(dist_dir.join("robots.txt")))
        .route_service("/sitemap.xml", ServeFile::new(dist_dir.join("sitemap.xml")))
        .route_service("/favicon.svg", ServeFile::new(dist_dir.join("favicon.svg")))
        .route_service(
            "/apple-touch-icon.png",
            ServeFile::new(dist_dir.join("apple-touch-icon.png")),
        )
        .nest_service("/assets", ServeDir::new(dist_dir.join("assets")))
        .fallback(not_found)
        // Static assets and SPA fallback are server endpoints too, so apply
        // the same per-client policy outside the API route table.
        .layer(middleware::from_fn_with_state(state.clone(), rate_limit))
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}
async fn shutdown() {
    let _ = tokio::signal::ctrl_c().await;
    info!("shutdown received");
}
async fn open_db(path: &std::path::Path) -> Result<SqlitePool, sqlx::Error> {
    let options = SqliteConnectOptions::from_str(&format!("sqlite://{}", path.display()))?
        .create_if_missing(true)
        .foreign_keys(true)
        // Azure Files does not provide SQLite-compatible POSIX byte-range
        // locks. unix-dotfile uses an atomic lock directory on the mounted
        // share instead; one replica and one connection preserve correctness.
        .vfs("unix-dotfile")
        // Do not mutate journal_mode during startup. Azure briefly overlaps
        // old and new revisions on the same mounted database during rollout;
        // changing the mode then requires an exclusive lock and prevents boot.
        .busy_timeout(StdDuration::from_secs(10));
    SqlitePoolOptions::new()
        // The production database lives on a single-replica Azure Files
        // mount. One connection avoids SMB byte-range lock contention while
        // still allowing Tokio callers to queue safely.
        .max_connections(1)
        .connect_with(options)
        .await
}
async fn init_db(db: &SqlitePool) -> Result<(), sqlx::Error> {
    for statement in [
        "CREATE TABLE IF NOT EXISTS clients (id INTEGER PRIMARY KEY, name TEXT NOT NULL, token TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL)",
        "CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, price_cents INTEGER, currency TEXT NOT NULL DEFAULT 'USD', stock_note TEXT NOT NULL DEFAULT '', visible INTEGER NOT NULL DEFAULT 1)",
        "CREATE TABLE IF NOT EXISTS requests (id INTEGER PRIMARY KEY, reference TEXT NOT NULL UNIQUE, client_id INTEGER NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT, client_reference TEXT, note TEXT, status TEXT NOT NULL DEFAULT 'new', created_at TEXT NOT NULL, FOREIGN KEY(client_id) REFERENCES clients(id))",
        "CREATE TABLE IF NOT EXISTS request_items (request_id INTEGER NOT NULL, product_id INTEGER NOT NULL, quantity INTEGER NOT NULL, FOREIGN KEY(request_id) REFERENCES requests(id), FOREIGN KEY(product_id) REFERENCES products(id))",
        "CREATE TABLE IF NOT EXISTS client_products (client_id INTEGER NOT NULL, product_id INTEGER NOT NULL, PRIMARY KEY(client_id, product_id), FOREIGN KEY(client_id) REFERENCES clients(id), FOREIGN KEY(product_id) REFERENCES products(id))",
        "CREATE TABLE IF NOT EXISTS request_deletion_audit (id INTEGER PRIMARY KEY, request_id INTEGER NOT NULL, deleted_at TEXT NOT NULL, action TEXT NOT NULL)",
        "CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
    ] {
        sqlx::query(statement).execute(db).await?;
    }
    // The original predictable demo credential was publicly shipped. Rotate
    // and expire it while preserving any requests already attached to it.
    sqlx::query("UPDATE clients SET token=?, expires_at=? WHERE token='demo-client'")
        .bind(format!("revoked-{}", random_token()))
        .bind((Utc::now() - Duration::seconds(1)).to_rfc3339())
        .execute(db)
        .await?;
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM clients WHERE expires_at > ?")
        .bind(Utc::now().to_rfc3339())
        .fetch_one(db)
        .await?;
    if count == 0 {
        let expiry = (Utc::now() + Duration::days(365)).to_rfc3339();
        sqlx::query(
            "INSERT INTO clients (name, token, expires_at) VALUES ('First private client', ?, ?)",
        )
        .bind(random_token())
        .bind(expiry)
        .execute(db)
        .await?;
    }
    let product_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM products")
        .fetch_one(db)
        .await?;
    if product_count == 0 {
        sqlx::query("INSERT INTO products (name,description,price_cents,currency,stock_note) VALUES ('Quarterly maintenance visit','A careful on-site check, clean and adjustment for your existing installation.',18500,'USD','Booked after we confirm a suitable time.'),('Replacement fitting set','A matched set prepared for your existing order or specification.',NULL,'USD','Price and compatibility confirmed in the quote.'),('Repeat consumables pack','The usual replenishment pack, picked against your previous order.',4200,'USD','Availability manually confirmed before we quote.')").execute(db).await?;
    }
    Ok(())
}
/// Adds the per-client visibility and privacy-deletion tables to databases
/// created before this repair. The one-time migration keeps the previous
/// behaviour for existing links, then every later assignment is explicit.
async fn migrate_db(db: &SqlitePool) -> Result<(), sqlx::Error> {
    for statement in [
        "CREATE TABLE IF NOT EXISTS client_products (client_id INTEGER NOT NULL, product_id INTEGER NOT NULL, PRIMARY KEY(client_id, product_id), FOREIGN KEY(client_id) REFERENCES clients(id), FOREIGN KEY(product_id) REFERENCES products(id))",
        "CREATE TABLE IF NOT EXISTS request_deletion_audit (id INTEGER PRIMARY KEY, request_id INTEGER NOT NULL, deleted_at TEXT NOT NULL, action TEXT NOT NULL)",
        "CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
    ] {
        sqlx::query(statement).execute(db).await?;
    }
    let migration_id = "client-offer-assignments-v1";
    let already_applied: Option<String> =
        sqlx::query_scalar("SELECT id FROM schema_migrations WHERE id=?")
            .bind(migration_id)
            .fetch_optional(db)
            .await?;
    if already_applied.is_none() {
        let mut tx = db.begin().await?;
        // Existing private links used to see all visible offers. Retain that
        // choice exactly once so the upgrade does not silently empty a client
        // catalogue; owners can now narrow each link in the workspace.
        sqlx::query(
            "INSERT OR IGNORE INTO client_products (client_id, product_id) SELECT c.id, p.id FROM clients c CROSS JOIN products p WHERE p.visible=1",
        )
        .execute(&mut *tx)
        .await?;
        sqlx::query("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)")
            .bind(migration_id)
            .bind(Utc::now().to_rfc3339())
            .execute(&mut *tx)
            .await?;
        tx.commit().await?;
    }
    Ok(())
}
async fn rate_limit(State(state): State<AppState>, req: Request, next: Next) -> Response {
    // Health checks must remain dependable under client traffic. Every other
    // route, including static files and the SPA fallback, is limited below.
    if req.uri().path() == "/health" {
        return with_security_headers(next.run(req).await, false);
    }
    let key = req
        .headers()
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.split(',').next())
        .unwrap_or("local")
        .trim()
        .to_owned();
    let rejected = {
        let mut limits = state.limiter.lock().expect("rate lock");
        let now = Instant::now();
        limits.retain(|_, window| {
            now.duration_since(window.updated_at) < StdDuration::from_secs(300)
        });
        let entry = limits.entry(key).or_insert(Window {
            updated_at: now,
            tokens: RATE_LIMIT_BURST,
        });
        let elapsed = now.duration_since(entry.updated_at).as_secs_f64();
        entry.tokens = (entry.tokens + elapsed * RATE_LIMIT_PER_SECOND).min(RATE_LIMIT_BURST);
        entry.updated_at = now;
        if entry.tokens < 1.0 {
            true
        } else {
            entry.tokens -= 1.0;
            false
        }
    };
    if rejected {
        let mut response = (
            StatusCode::TOO_MANY_REQUESTS,
            Json(serde_json::json!({"error":"Too many requests. Try again shortly."})),
        )
            .into_response();
        response
            .headers_mut()
            .insert(header::RETRY_AFTER, HeaderValue::from_static("1"));
        return with_security_headers(response, false);
    }
    let immutable = req.uri().path().starts_with("/assets/");
    with_security_headers(next.run(req).await, immutable)
}
fn with_security_headers(mut response: Response, immutable: bool) -> Response {
    let headers = response.headers_mut();
    headers.insert(
        "x-content-type-options",
        HeaderValue::from_static("nosniff"),
    );
    headers.insert("referrer-policy", HeaderValue::from_static("same-origin"));
    headers.insert("x-frame-options", HeaderValue::from_static("DENY"));
    headers.insert(
        "content-security-policy",
        HeaderValue::from_static("default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"),
    );
    headers.insert(
        "strict-transport-security",
        HeaderValue::from_static("max-age=31536000; includeSubDomains"),
    );
    headers.insert(
        "permissions-policy",
        HeaderValue::from_static("camera=(), microphone=(), geolocation=(), payment=()"),
    );
    headers.insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static(if immutable {
            "public, max-age=31536000, immutable"
        } else {
            "no-store"
        }),
    );
    response
}
async fn not_found(State(state): State<AppState>) -> Response {
    (
        StatusCode::NOT_FOUND,
        Html(state.not_found_html.as_str().to_owned()),
    )
        .into_response()
}
async fn health(State(state): State<AppState>) -> impl IntoResponse {
    Json(serde_json::json!({"ok":true,"build_sha":state.build_sha}))
}
async fn get_catalog(State(state): State<AppState>, Path(token): Path<String>) -> Response {
    if token == "demo-client" {
        return error(
            StatusCode::GONE,
            "This client link has expired or is not valid.",
        );
    }
    let client = sqlx::query_as::<_, (i64, String, String)>(
        "SELECT id,name,expires_at FROM clients WHERE token=? AND expires_at > ?",
    )
    .bind(token)
    .bind(Utc::now().to_rfc3339())
    .fetch_optional(&state.db)
    .await;
    match client {
        Ok(Some((id, name, expiry))) => match sqlx::query_as::<_, Product>(
            "SELECT p.id,p.name,p.description,p.price_cents,p.currency,p.stock_note,p.visible FROM products p INNER JOIN client_products cp ON cp.product_id=p.id WHERE cp.client_id=? AND p.visible=1 ORDER BY p.id",
        )
        .bind(id)
        .fetch_all(&state.db)
        .await
        {
            Ok(products) => Json(Catalog {
                business_name: "Field & Form".into(),
                client_name: name,
                expires_at: expiry,
                products,
            })
            .into_response(),
            Err(_) => error(StatusCode::INTERNAL_SERVER_ERROR, "Catalog storage is unavailable."),
        },
        Ok(None) => error(StatusCode::GONE, "This client link has expired or is not valid."),
        Err(_) => error(StatusCode::INTERNAL_SERVER_ERROR, "Catalog storage is unavailable."),
    }
}
fn demo_catalog() -> Catalog {
    Catalog {
        business_name: "Field & Form sample".into(),
        client_name: "Avery at North Street".into(),
        expires_at: (Utc::now() + Duration::days(1)).to_rfc3339(),
        products: vec![
            Product {
                id: 1,
                name: "Quarterly maintenance visit".into(),
                description:
                    "An on-site check, clean, and adjustment for an existing installation.".into(),
                price_cents: Some(18_500),
                currency: "USD".into(),
                stock_note: "Booked after a suitable time is confirmed.".into(),
                visible: true,
            },
            Product {
                id: 2,
                name: "Replacement fitting set".into(),
                description: "A matched set prepared for an existing order or specification."
                    .into(),
                price_cents: None,
                currency: "USD".into(),
                stock_note: "Price and compatibility are confirmed in the quote.".into(),
                visible: true,
            },
            Product {
                id: 3,
                name: "Repeat consumables pack".into(),
                description: "The usual replenishment pack, picked against a previous order."
                    .into(),
                price_cents: Some(4_200),
                currency: "USD".into(),
                stock_note: "Availability is checked before quoting.".into(),
                visible: true,
            },
        ],
    }
}
async fn get_demo_catalog() -> Response {
    Json(demo_catalog()).into_response()
}
async fn create_demo_request(Json(input): Json<RequestInput>) -> Response {
    if let Some(response) = validate_request(&input) {
        return response;
    }
    let valid_ids = [1_i64, 2, 3];
    if input
        .items
        .iter()
        .any(|item| !valid_ids.contains(&item.product_id))
    {
        return error(
            StatusCode::BAD_REQUEST,
            "One selected sample offer is unavailable. Reset the demo and try again.",
        );
    }
    Json(serde_json::json!({"reference":"DEMO-0421","saved":false})).into_response()
}
async fn create_request(
    State(state): State<AppState>,
    Path(token): Path<String>,
    Json(input): Json<RequestInput>,
) -> Response {
    if token == "demo-client" {
        return error(
            StatusCode::GONE,
            "This client link has expired or is not valid.",
        );
    }
    if let Some(response) = validate_request(&input) {
        return response;
    }
    let client = match sqlx::query_scalar::<_, i64>(
        "SELECT id FROM clients WHERE token=? AND expires_at > ?",
    )
    .bind(token)
    .bind(Utc::now().to_rfc3339())
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(id)) => id,
        Ok(None) => {
            return error(
                StatusCode::GONE,
                "This client link has expired or is not valid.",
            )
        }
        Err(_) => {
            return error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Catalog storage is unavailable.",
            )
        }
    };
    // Validate the selected products before acquiring SQLite's single writer.
    // The write transaction itself does no read-before-write reference race.
    for item in &input.items {
        let valid = sqlx::query_scalar::<_, i64>(
            "SELECT p.id FROM products p INNER JOIN client_products cp ON cp.product_id=p.id WHERE p.id=? AND p.visible=1 AND cp.client_id=?",
        )
                .bind(item.product_id)
                .bind(client)
                .fetch_optional(&state.db)
                .await;
        if !matches!(valid, Ok(Some(_))) {
            return error(
                StatusCode::BAD_REQUEST,
                "One selected offer is no longer available. Refresh and try again.",
            );
        }
    }
    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(_) => {
            return error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Could not save the request.",
            )
        }
    };
    let provisional_reference = format!("pending-{}", random_token());
    let result = sqlx::query("INSERT INTO requests (reference,client_id,name,email,phone,client_reference,note,status,created_at) VALUES (?,?,?,?,?,?,?,'new',?)").bind(&provisional_reference).bind(client).bind(input.name.trim()).bind(input.email.trim()).bind(input.phone.filter(|x| !x.trim().is_empty())).bind(input.reference.filter(|x| !x.trim().is_empty())).bind(input.note.filter(|x| !x.trim().is_empty())).bind(Utc::now().to_rfc3339()).execute(&mut *tx).await;
    let request_id = match result {
        Ok(x) => x.last_insert_rowid(),
        Err(_) => {
            return error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Could not save the request.",
            )
        }
    };
    let reference = format!("CRC-{:06}", request_id);
    if sqlx::query("UPDATE requests SET reference=? WHERE id=?")
        .bind(&reference)
        .bind(request_id)
        .execute(&mut *tx)
        .await
        .is_err()
    {
        return error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Could not save the request.",
        );
    }
    for item in input.items {
        if sqlx::query("INSERT INTO request_items (request_id,product_id,quantity) VALUES (?,?,?)")
            .bind(request_id)
            .bind(item.product_id)
            .bind(item.quantity)
            .execute(&mut *tx)
            .await
            .is_err()
        {
            return error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Could not save the request.",
            );
        }
    }
    if tx.commit().await.is_err() {
        return error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Could not save the request.",
        );
    }
    Json(serde_json::json!({"reference":reference})).into_response()
}
fn validate_request(input: &RequestInput) -> Option<Response> {
    if input.name.trim().is_empty()
        || input.name.len() > 120
        || !valid_email(&input.email)
        || input.items.is_empty()
        || input.items.len() > 30
        || input.note.as_deref().unwrap_or("").len() > 2000
    {
        return Some(error(
            StatusCode::BAD_REQUEST,
            "Enter a name, valid email, selected offer, and a shorter note.",
        ));
    }
    if input
        .items
        .iter()
        .any(|item| item.product_id < 1 || !(1..=100).contains(&item.quantity))
    {
        return Some(error(
            StatusCode::BAD_REQUEST,
            "Each selected quantity must be between 1 and 100.",
        ));
    }
    None
}
async fn overview(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if !owner(&state, &headers) {
        return error(StatusCode::UNAUTHORIZED, "Owner code required.");
    }
    let products = sqlx::query_as::<_, Product>("SELECT id,name,description,price_cents,currency,stock_note,visible FROM products ORDER BY id DESC").fetch_all(&state.db).await.unwrap_or_default();
    let requests = request_rows(&state.db, None).await.unwrap_or_default();
    let clients = client_links(&state.db).await.unwrap_or_default();
    let deletion_audit_count = sqlx::query_scalar("SELECT COUNT(*) FROM request_deletion_audit")
        .fetch_one(&state.db)
        .await
        .unwrap_or(0);
    Json(Overview {
        business_name: "Field & Form".into(),
        clients,
        products,
        requests,
        deletion_audit_count,
    })
    .into_response()
}
async fn create_client(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(input): Json<ClientInput>,
) -> Response {
    if !owner(&state, &headers) {
        return error(StatusCode::UNAUTHORIZED, "Owner code required.");
    }
    let name = input.name.trim();
    let days = input.expires_in_days.unwrap_or(90);
    if name.is_empty() || name.len() > 120 || !(1..=365).contains(&days) {
        return error(
            StatusCode::BAD_REQUEST,
            "Enter a client name and an expiry from 1 to 365 days.",
        );
    }
    let token = random_token();
    let expires_at = (Utc::now() + Duration::days(days)).to_rfc3339();
    let offer_ids = match input.offer_ids {
        Some(ids) => match validated_offer_ids(&state.db, ids).await {
            Ok(ids) => ids,
            Err(response) => return response,
        },
        // API users from before this repair did not send assignment data.
        // Keep those links usable while the owner workspace sends an explicit
        // checked list on every new client link.
        None => visible_offer_ids(&state.db).await,
    };
    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(_) => {
            return error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Could not create that client link.",
            )
        }
    };
    let row = match sqlx::query("INSERT INTO clients (name,token,expires_at) VALUES (?,?,?)")
        .bind(name)
        .bind(&token)
        .bind(&expires_at)
        .execute(&mut *tx)
        .await
    {
        Ok(row) => row,
        Err(_) => {
            return error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Could not create that client link.",
            )
        }
    };
    let id = row.last_insert_rowid();
    if let Err(response) = replace_client_offers(&mut tx, id, &offer_ids).await {
        return response;
    }
    if tx.commit().await.is_err() {
        return error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Could not create that client link.",
        );
    }
    Json(ClientLink {
        id,
        name: name.into(),
        token,
        expires_at,
        assigned_product_ids: offer_ids,
    })
    .into_response()
}
async fn set_client_offers(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<i64>,
    Json(input): Json<OfferAssignmentInput>,
) -> Response {
    if !owner(&state, &headers) {
        return error(StatusCode::UNAUTHORIZED, "Owner code required.");
    }
    let offer_ids = match validated_offer_ids(&state.db, input.product_ids).await {
        Ok(ids) => ids,
        Err(response) => return response,
    };
    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(_) => {
            return error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Could not update offer visibility.",
            )
        }
    };
    let exists = match sqlx::query_scalar::<_, i64>("SELECT id FROM clients WHERE id=?")
        .bind(id)
        .fetch_optional(&mut *tx)
        .await
    {
        Ok(Some(_)) => true,
        Ok(None) => false,
        Err(_) => {
            return error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Could not update offer visibility.",
            )
        }
    };
    if !exists {
        return error(StatusCode::NOT_FOUND, "Client link not found.");
    }
    if let Err(response) = replace_client_offers(&mut tx, id, &offer_ids).await {
        return response;
    }
    if tx.commit().await.is_err() {
        return error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Could not update offer visibility.",
        );
    }
    Json(serde_json::json!({"ok":true,"assigned_product_ids":offer_ids})).into_response()
}
async fn visible_offer_ids(db: &SqlitePool) -> Vec<i64> {
    sqlx::query_scalar("SELECT id FROM products WHERE visible=1 ORDER BY id")
        .fetch_all(db)
        .await
        .unwrap_or_default()
}
async fn validated_offer_ids(
    db: &SqlitePool,
    mut offer_ids: Vec<i64>,
) -> Result<Vec<i64>, Response> {
    if offer_ids.len() > 250 || offer_ids.iter().any(|id| *id < 1) {
        return Err(error(
            StatusCode::BAD_REQUEST,
            "Choose valid offers for this client.",
        ));
    }
    offer_ids.sort_unstable();
    offer_ids.dedup();
    for id in &offer_ids {
        let valid =
            sqlx::query_scalar::<_, i64>("SELECT id FROM products WHERE id=? AND visible=1")
                .bind(id)
                .fetch_optional(db)
                .await;
        if !matches!(valid, Ok(Some(_))) {
            return Err(error(
                StatusCode::BAD_REQUEST,
                "Choose valid offers for this client.",
            ));
        }
    }
    Ok(offer_ids)
}
async fn replace_client_offers(
    tx: &mut sqlx::Transaction<'_, Sqlite>,
    client_id: i64,
    offer_ids: &[i64],
) -> Result<(), Response> {
    if sqlx::query("DELETE FROM client_products WHERE client_id=?")
        .bind(client_id)
        .execute(&mut **tx)
        .await
        .is_err()
    {
        return Err(error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Could not update offer visibility.",
        ));
    }
    for product_id in offer_ids {
        if sqlx::query("INSERT INTO client_products (client_id,product_id) VALUES (?,?)")
            .bind(client_id)
            .bind(product_id)
            .execute(&mut **tx)
            .await
            .is_err()
        {
            return Err(error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Could not update offer visibility.",
            ));
        }
    }
    Ok(())
}
async fn client_links(db: &SqlitePool) -> Result<Vec<ClientLink>, sqlx::Error> {
    let rows = sqlx::query_as::<_, ClientLinkRow>(
        "SELECT c.id,c.name,c.token,c.expires_at,COALESCE(group_concat(cp.product_id), '') assigned_product_ids FROM clients c LEFT JOIN client_products cp ON cp.client_id=c.id WHERE c.token <> 'demo-client' AND c.token NOT LIKE 'revoked-%' GROUP BY c.id ORDER BY c.id DESC",
    )
    .fetch_all(db)
    .await?;
    Ok(rows
        .into_iter()
        .map(|row| ClientLink {
            id: row.id,
            name: row.name,
            token: row.token,
            expires_at: row.expires_at,
            assigned_product_ids: row
                .assigned_product_ids
                .split(',')
                .filter_map(|id| id.parse::<i64>().ok())
                .collect(),
        })
        .collect())
}
async fn request_rows(
    db: &SqlitePool,
    request_id: Option<i64>,
) -> Result<Vec<InboxRow>, sqlx::Error> {
    match request_id {
        Some(id) => sqlx::query_as::<_, InboxRow>(
            "SELECT r.id,r.reference,r.name,r.email,r.note,r.status,r.created_at,COALESCE(group_concat(p.name || ' x ' || ri.quantity, '; '),'') items FROM requests r LEFT JOIN request_items ri ON ri.request_id=r.id LEFT JOIN products p ON p.id=ri.product_id WHERE r.id=? GROUP BY r.id ORDER BY r.id DESC",
        )
        .bind(id)
        .fetch_all(db)
        .await,
        None => sqlx::query_as::<_, InboxRow>(
            "SELECT r.id,r.reference,r.name,r.email,r.note,r.status,r.created_at,COALESCE(group_concat(p.name || ' x ' || ri.quantity, '; '),'') items FROM requests r LEFT JOIN request_items ri ON ri.request_id=r.id LEFT JOIN products p ON p.id=ri.product_id GROUP BY r.id ORDER BY r.id DESC",
        )
        .fetch_all(db)
        .await,
    }
}
async fn revoke_client(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<i64>,
) -> Response {
    if !owner(&state, &headers) {
        return error(StatusCode::UNAUTHORIZED, "Owner code required.");
    }
    match sqlx::query("UPDATE clients SET expires_at=? WHERE id=?")
        .bind((Utc::now() - Duration::seconds(1)).to_rfc3339())
        .bind(id)
        .execute(&state.db)
        .await
    {
        Ok(result) if result.rows_affected() == 1 => {
            Json(serde_json::json!({"ok":true})).into_response()
        }
        Ok(_) => error(StatusCode::NOT_FOUND, "Client link not found."),
        Err(_) => error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Could not revoke that client link.",
        ),
    }
}
async fn create_product(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(input): Json<ProductInput>,
) -> Response {
    if !owner(&state, &headers) {
        return error(StatusCode::UNAUTHORIZED, "Owner code required.");
    }
    if input.name.trim().is_empty()
        || input.name.len() > 120
        || input.description.trim().is_empty()
        || input.description.len() > 1000
    {
        return error(StatusCode::BAD_REQUEST, "Add a short name and description.");
    }
    let price = match input.price_cents.filter(|p| !p.trim().is_empty()) {
        Some(p) => match p.parse::<i64>() {
            Ok(n) if (0..=100_000_000).contains(&n) => Some(n),
            _ => {
                return error(
                    StatusCode::BAD_REQUEST,
                    "Price must be a whole number of cents.",
                )
            }
        },
        None => None,
    };
    match sqlx::query(
        "INSERT INTO products (name,description,price_cents,stock_note) VALUES (?,?,?,?)",
    )
    .bind(input.name.trim())
    .bind(input.description.trim())
    .bind(price)
    .bind(input.stock_note.unwrap_or_default())
    .execute(&state.db)
    .await
    {
        Ok(_) => Json(serde_json::json!({"ok":true})).into_response(),
        Err(_) => error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Could not save that offer.",
        ),
    }
}
async fn update_status(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<i64>,
    Json(input): Json<StatusInput>,
) -> Response {
    if !owner(&state, &headers) {
        return error(StatusCode::UNAUTHORIZED, "Owner code required.");
    }
    if !["new", "quoted", "closed"].contains(&input.status.as_str()) {
        return error(StatusCode::BAD_REQUEST, "Invalid request status.");
    }
    match sqlx::query("UPDATE requests SET status=? WHERE id=?")
        .bind(input.status)
        .bind(id)
        .execute(&state.db)
        .await
    {
        Ok(x) if x.rows_affected() > 0 => Json(serde_json::json!({"ok":true})).into_response(),
        Ok(_) => error(StatusCode::NOT_FOUND, "Request not found."),
        Err(_) => error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Could not update request.",
        ),
    }
}
async fn export_single_csv(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(request_file): Path<String>,
) -> Response {
    if !owner(&state, &headers) {
        return error(StatusCode::UNAUTHORIZED, "Owner code required.");
    }
    let Some(id) = request_file
        .strip_suffix(".csv")
        .and_then(|value| value.parse::<i64>().ok())
        .filter(|id| *id > 0)
    else {
        return error(StatusCode::NOT_FOUND, "Request export not found.");
    };
    let rows = match request_rows(&state.db, Some(id)).await {
        Ok(rows) if rows.len() == 1 => rows,
        Ok(_) => return error(StatusCode::NOT_FOUND, "Request not found."),
        Err(_) => {
            return error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Could not create the request export.",
            )
        }
    };
    csv_response(rows, "request-export.csv")
}
async fn export_csv(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if !owner(&state, &headers) {
        return error(StatusCode::UNAUTHORIZED, "Owner code required.");
    }
    let rows = match request_rows(&state.db, None).await {
        Ok(rows) => rows,
        Err(_) => {
            return error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Could not create the inbox export.",
            )
        }
    };
    csv_response(rows, "client-requests.csv")
}
fn csv_response(rows: Vec<InboxRow>, filename: &str) -> Response {
    let mut csv = "reference,name,email,status,created_at,items,note\n".to_string();
    for r in rows {
        csv.push_str(&format!(
            "{}\n",
            [
                r.reference,
                r.name,
                r.email,
                r.status,
                r.created_at,
                r.items,
                r.note.unwrap_or_default()
            ]
            .iter()
            .map(|x| format!("\"{}\"", x.replace('"', "\"\"")))
            .collect::<Vec<_>>()
            .join(",")
        ));
    }
    (
        [
            (header::CONTENT_TYPE, "text/csv; charset=utf-8".to_owned()),
            (
                header::CONTENT_DISPOSITION,
                format!("attachment; filename={filename}"),
            ),
        ],
        csv,
    )
        .into_response()
}
async fn export_pdf(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if !owner(&state, &headers) {
        return error(StatusCode::UNAUTHORIZED, "Owner code required.");
    }
    let rows = sqlx::query_as::<_, InboxRow>("SELECT r.id,r.reference,r.name,r.email,r.note,r.status,r.created_at,COALESCE(group_concat(p.name || ' x ' || ri.quantity, '; '),'') items FROM requests r LEFT JOIN request_items ri ON ri.request_id=r.id LEFT JOIN products p ON p.id=ri.product_id GROUP BY r.id ORDER BY r.id DESC").fetch_all(&state.db).await.unwrap_or_default();
    let mut lines = vec![
        "Field & Form — request inbox".to_owned(),
        format!("Exported {}", Utc::now().format("%Y-%m-%d")),
        "".to_owned(),
    ];
    for r in rows {
        lines.push(format!(
            "{} · {} · {} · {}",
            r.reference, r.status, r.name, r.email
        ));
        lines.push(format!("  {}", r.items));
        if let Some(note) = r.note {
            lines.push(format!("  Note: {}", note));
        }
        lines.push("".to_owned());
    }
    (
        [
            (header::CONTENT_TYPE, "application/pdf"),
            (
                header::CONTENT_DISPOSITION,
                "attachment; filename=client-requests.pdf",
            ),
        ],
        simple_pdf(lines),
    )
        .into_response()
}
async fn delete_requests(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if !owner(&state, &headers) {
        return error(StatusCode::UNAUTHORIZED, "Owner code required.");
    }
    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(_) => {
            return error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Could not delete request data.",
            )
        }
    };
    let ids: Vec<i64> = match sqlx::query_scalar("SELECT id FROM requests")
        .fetch_all(&mut *tx)
        .await
    {
        Ok(ids) => ids,
        Err(_) => {
            return error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Could not delete request data.",
            )
        }
    };
    if sqlx::query("DELETE FROM request_items")
        .execute(&mut *tx)
        .await
        .is_err()
        || sqlx::query("DELETE FROM requests")
            .execute(&mut *tx)
            .await
            .is_err()
    {
        return error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Could not delete request data.",
        );
    }
    for id in &ids {
        if sqlx::query(
            "INSERT INTO request_deletion_audit (request_id,deleted_at,action) VALUES (?,?,?)",
        )
        .bind(id)
        .bind(Utc::now().to_rfc3339())
        .bind("bulk-owner-delete")
        .execute(&mut *tx)
        .await
        .is_err()
        {
            return error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Could not delete request data.",
            );
        }
    }
    if tx.commit().await.is_err() {
        return error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Could not delete request data.",
        );
    }
    Json(serde_json::json!({"ok":true,"audit_records_added":ids.len()})).into_response()
}
async fn delete_request(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<i64>,
) -> Response {
    if !owner(&state, &headers) {
        return error(StatusCode::UNAUTHORIZED, "Owner code required.");
    }
    if id < 1 {
        return error(StatusCode::NOT_FOUND, "Request not found.");
    }
    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(_) => {
            return error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Could not delete this request.",
            )
        }
    };
    let found = match sqlx::query_scalar::<_, i64>("SELECT id FROM requests WHERE id=?")
        .bind(id)
        .fetch_optional(&mut *tx)
        .await
    {
        Ok(found) => found,
        Err(_) => {
            return error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Could not delete this request.",
            )
        }
    };
    if found.is_none() {
        return error(StatusCode::NOT_FOUND, "Request not found.");
    }
    if sqlx::query("DELETE FROM request_items WHERE request_id=?")
        .bind(id)
        .execute(&mut *tx)
        .await
        .is_err()
        || sqlx::query("DELETE FROM requests WHERE id=?")
            .bind(id)
            .execute(&mut *tx)
            .await
            .is_err()
        || sqlx::query(
            "INSERT INTO request_deletion_audit (request_id,deleted_at,action) VALUES (?,?,?)",
        )
        .bind(id)
        .bind(Utc::now().to_rfc3339())
        .bind("individual-owner-delete")
        .execute(&mut *tx)
        .await
        .is_err()
    {
        return error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Could not delete this request.",
        );
    }
    if tx.commit().await.is_err() {
        return error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Could not delete this request.",
        );
    }
    Json(serde_json::json!({
        "ok":true,
        "audit_recorded":true,
        "message":"Request deleted. The audit record keeps only an internal request ID, action, and date."
    }))
    .into_response()
}
fn owner(state: &AppState, headers: &HeaderMap) -> bool {
    headers
        .get("x-owner-code")
        .and_then(|x| x.to_str().ok())
        .map(|x| x == state.owner_code.as_str())
        .unwrap_or(false)
}
fn valid_email(value: &str) -> bool {
    let value = value.trim();
    value.len() <= 254 && value.contains('@') && !value.starts_with('@') && !value.ends_with('@')
}
fn random_token() -> String {
    rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(40)
        .map(char::from)
        .collect()
}
fn error(status: StatusCode, message: &str) -> Response {
    (status, Json(serde_json::json!({"error":message}))).into_response()
}
fn simple_pdf(lines: Vec<String>) -> Vec<u8> {
    let mut stream = "BT\n/F1 11 Tf\n50 760 Td\n".to_owned();
    for line in lines.into_iter().take(42) {
        let safe = line
            .replace('\\', "\\\\")
            .replace('(', "\\(")
            .replace(')', "\\)")
            .replace(|c: char| !c.is_ascii(), "?");
        stream.push_str(&format!("({}) Tj\n0 -16 Td\n", safe));
    }
    stream.push_str("ET\n");
    let objects=vec!["<< /Type /Catalog /Pages 2 0 R >>".to_owned(),"<< /Type /Pages /Kids [3 0 R] /Count 1 >>".to_owned(),"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>".to_owned(),"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>".to_owned(),format!("<< /Length {} >>\nstream\n{}endstream",stream.len(),stream)];
    let mut pdf = b"%PDF-1.4\n".to_vec();
    let mut offsets = Vec::new();
    for (i, object) in objects.iter().enumerate() {
        offsets.push(pdf.len());
        pdf.extend_from_slice(format!("{} 0 obj\n{}\nendobj\n", i + 1, object).as_bytes());
    }
    let xref = pdf.len();
    pdf.extend_from_slice(
        format!("xref\n0 {}\n0000000000 65535 f \n", objects.len() + 1).as_bytes(),
    );
    for offset in offsets {
        pdf.extend_from_slice(format!("{:010} 00000 n \n", offset).as_bytes());
    }
    pdf.extend_from_slice(
        format!(
            "trailer\n<< /Size {} /Root 1 0 R >>\nstartxref\n{}\n%%EOF\n",
            objects.len() + 1,
            xref
        )
        .as_bytes(),
    );
    pdf
}
#[cfg(test)]
mod tests {
    use super::*;
    use axum::{body::Body, http::Request};
    use tempfile::TempDir;
    use tower::ServiceExt;

    async fn test_state(dir: &TempDir) -> AppState {
        let db_path = dir.path().join("catalog.sqlite");
        let db = open_db(&db_path).await.expect("open test sqlite");
        init_db(&db).await.expect("initialize test sqlite");
        migrate_db(&db).await.expect("migrate test sqlite");
        AppState {
            db,
            owner_code: Arc::new("test-owner-code".into()),
            limiter: Arc::new(Mutex::new(HashMap::new())),
            build_sha: "test".into(),
            not_found_html: Arc::new(String::new()),
        }
    }

    fn request(path: &str, client: &str) -> Request<Body> {
        Request::builder()
            .uri(path)
            .header("x-forwarded-for", format!("{client}, 10.0.0.1"))
            .body(Body::empty())
            .expect("test request")
    }
    #[test]
    fn validates_normal_email() {
        assert!(valid_email("hello@example.test"));
        assert!(!valid_email("not-an-email"));
        assert!(!valid_email("@example.test"));
    }
    #[test]
    fn creates_a_valid_pdf_header() {
        assert!(simple_pdf(vec!["one request".into()]).starts_with(b"%PDF-1.4"));
    }
    #[tokio::test]
    async fn existing_database_serves_health_without_startup_writes() {
        let dir = TempDir::new().expect("temporary app directory");
        let original = test_state(&dir).await;
        let mut write = original.db.begin().await.expect("begin old revision write");
        sqlx::query("UPDATE products SET stock_note=stock_note WHERE id=1")
            .execute(&mut *write)
            .await
            .expect("hold old revision write transaction");

        let second_pool = open_db(&dir.path().join("catalog.sqlite"))
            .await
            .expect("open overlapping revision database");
        let overlapping = AppState {
            db: second_pool,
            owner_code: Arc::new("test-owner-code".into()),
            limiter: Arc::new(Mutex::new(HashMap::new())),
            build_sha: "overlap-test".into(),
            not_found_html: Arc::new(String::new()),
        };
        let response = app(overlapping, dir.path().to_path_buf())
            .oneshot(request("/health", "198.51.100.91"))
            .await
            .expect("health response during overlap");
        assert_eq!(response.status(), StatusCode::OK);
        write.rollback().await.expect("release old revision lock");
    }
    #[tokio::test]
    async fn legacy_public_token_is_revoked_without_duplicate_offers() {
        let dir = TempDir::new().expect("temporary app directory");
        let state = test_state(&dir).await;
        sqlx::query("UPDATE clients SET token='demo-client'")
            .execute(&state.db)
            .await
            .expect("recreate compromised legacy token");
        init_db(&state.db).await.expect("run startup migration");
        let legacy: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM clients WHERE token='demo-client'")
                .fetch_one(&state.db)
                .await
                .expect("legacy token count");
        let products: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM products")
            .fetch_one(&state.db)
            .await
            .expect("offer count");
        assert_eq!(legacy, 0);
        assert_eq!(products, 3);
    }
    #[tokio::test]
    async fn rate_limit_covers_api_and_404_routes_but_not_health() {
        let dir = TempDir::new().expect("temporary static directory");
        fs::write(
            dir.path().join("index.html"),
            "<!doctype html><title>test</title>",
        )
        .expect("write static test page");
        let app = app(test_state(&dir).await, dir.path().to_path_buf());

        for _ in 0..RATE_LIMIT_BURST as usize {
            let response = app
                .clone()
                .oneshot(request("/deep/client/link", "198.51.100.11"))
                .await
                .expect("SPA fallback response");
            assert_eq!(response.status(), StatusCode::NOT_FOUND);
        }
        let limited = app
            .clone()
            .oneshot(request("/deep/client/link", "198.51.100.11"))
            .await
            .expect("limited SPA response");
        assert_eq!(limited.status(), StatusCode::TOO_MANY_REQUESTS);
        assert_eq!(limited.headers().get(header::RETRY_AFTER).unwrap(), "1");

        for _ in 0..RATE_LIMIT_BURST as usize {
            let response = app
                .clone()
                .oneshot(request("/api/demo/catalog", "198.51.100.12"))
                .await
                .expect("catalog response");
            assert_eq!(response.status(), StatusCode::OK);
        }
        let limited_api = app
            .clone()
            .oneshot(request("/api/demo/catalog", "198.51.100.12"))
            .await
            .expect("limited API response");
        assert_eq!(limited_api.status(), StatusCode::TOO_MANY_REQUESTS);
        assert_eq!(limited_api.headers().get(header::RETRY_AFTER).unwrap(), "1");

        for _ in 0..(RATE_LIMIT_BURST as usize + 2) {
            let health = app
                .clone()
                .oneshot(request("/health", "198.51.100.13"))
                .await
                .expect("health response");
            assert_eq!(health.status(), StatusCode::OK);
        }
    }

    #[tokio::test]
    async fn client_offer_assignments_keep_catalogs_and_request_validation_separate() {
        use axum::body::to_bytes;

        let dir = TempDir::new().expect("temporary app directory");
        fs::write(
            dir.path().join("index.html"),
            "<!doctype html><title>test</title>",
        )
        .expect("write static test page");
        let state = test_state(&dir).await;
        let alpha_id = sqlx::query(
            "INSERT INTO clients (name,token,expires_at) VALUES ('Alpha','alpha-token',?)",
        )
        .bind((Utc::now() + Duration::days(30)).to_rfc3339())
        .execute(&state.db)
        .await
        .expect("insert alpha")
        .last_insert_rowid();
        let beta_id = sqlx::query(
            "INSERT INTO clients (name,token,expires_at) VALUES ('Beta','beta-token',?)",
        )
        .bind((Utc::now() + Duration::days(30)).to_rfc3339())
        .execute(&state.db)
        .await
        .expect("insert beta")
        .last_insert_rowid();
        let app = app(state, dir.path().to_path_buf());
        for (id, product_ids) in [(alpha_id, "[1]"), (beta_id, "[2]")] {
            let response = app
                .clone()
                .oneshot(
                    Request::builder()
                        .method("PATCH")
                        .uri(format!("/api/admin/clients/{id}"))
                        .header("x-owner-code", "test-owner-code")
                        .header("content-type", "application/json")
                        .body(Body::from(format!("{{\"product_ids\":{product_ids}}}")))
                        .expect("assignment request"),
                )
                .await
                .expect("assignment response");
            assert_eq!(response.status(), StatusCode::OK);
        }
        for (token, expected_id) in [("alpha-token", 1_i64), ("beta-token", 2_i64)] {
            let response = app
                .clone()
                .oneshot(request(
                    &format!("/api/catalog/{token}"),
                    &format!("198.51.100.{expected_id}"),
                ))
                .await
                .expect("private catalog response");
            assert_eq!(response.status(), StatusCode::OK);
            let body = to_bytes(response.into_body(), 4096)
                .await
                .expect("catalog body");
            let catalog: serde_json::Value = serde_json::from_slice(&body).expect("catalog JSON");
            assert_eq!(catalog["products"].as_array().unwrap().len(), 1);
            assert_eq!(catalog["products"][0]["id"], expected_id);
        }
        let rejected = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/catalog/alpha-token/requests")
                    .header("content-type", "application/json")
                    .header("x-forwarded-for", "198.51.100.40")
                    .body(Body::from(
                        r#"{"name":"Alpha requester","email":"alpha@example.test","items":[{"product_id":2,"quantity":1}]}"#,
                    ))
                    .expect("unassigned request"),
            )
            .await
            .expect("unassigned response");
        assert_eq!(rejected.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn individual_request_export_and_deletion_keep_other_people_and_audit_safe() {
        use axum::body::to_bytes;

        let dir = TempDir::new().expect("temporary app directory");
        fs::write(
            dir.path().join("index.html"),
            "<!doctype html><title>test</title>",
        )
        .expect("write static test page");
        let state = test_state(&dir).await;
        let token: String = sqlx::query_scalar("SELECT token FROM clients LIMIT 1")
            .fetch_one(&state.db)
            .await
            .expect("seeded client token");
        let app = app(state.clone(), dir.path().to_path_buf());
        for (email, address) in [
            ("first@example.test", "198.51.100.51"),
            ("second@example.test", "198.51.100.52"),
        ] {
            let response = app
                .clone()
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri(format!("/api/catalog/{token}/requests"))
                        .header("content-type", "application/json")
                        .header("x-forwarded-for", address)
                        .body(Body::from(format!("{{\"name\":\"Requester\",\"email\":\"{email}\",\"items\":[{{\"product_id\":1,\"quantity\":1}}]}}")))
                        .expect("saved request"),
                )
                .await
                .expect("saved request response");
            assert_eq!(response.status(), StatusCode::OK);
        }
        let first_id: i64 =
            sqlx::query_scalar("SELECT id FROM requests WHERE email='first@example.test'")
                .fetch_one(&state.db)
                .await
                .expect("first request id");
        let second_id: i64 =
            sqlx::query_scalar("SELECT id FROM requests WHERE email='second@example.test'")
                .fetch_one(&state.db)
                .await
                .expect("second request id");
        let exported = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri(format!("/api/admin/requests/{first_id}.csv"))
                    .header("x-owner-code", "test-owner-code")
                    .body(Body::empty())
                    .expect("individual export request"),
            )
            .await
            .expect("individual export response");
        assert_eq!(exported.status(), StatusCode::OK);
        let csv = String::from_utf8(
            to_bytes(exported.into_body(), 4096)
                .await
                .expect("CSV body")
                .to_vec(),
        )
        .expect("CSV text");
        assert!(csv.contains("first@example.test"));
        assert!(!csv.contains("second@example.test"));
        let deleted = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("DELETE")
                    .uri(format!("/api/admin/requests/{first_id}"))
                    .header("x-owner-code", "test-owner-code")
                    .body(Body::empty())
                    .expect("individual deletion request"),
            )
            .await
            .expect("individual deletion response");
        assert_eq!(deleted.status(), StatusCode::OK);
        let missing_export = app
            .oneshot(
                Request::builder()
                    .uri(format!("/api/admin/requests/{first_id}.csv"))
                    .header("x-owner-code", "test-owner-code")
                    .body(Body::empty())
                    .expect("missing individual export request"),
            )
            .await
            .expect("missing individual export response");
        assert_eq!(missing_export.status(), StatusCode::NOT_FOUND);
        let remaining: Vec<String> = sqlx::query_scalar("SELECT email FROM requests ORDER BY id")
            .fetch_all(&state.db)
            .await
            .expect("remaining requests");
        assert_eq!(remaining, vec!["second@example.test"]);
        let audit: (i64, String) = sqlx::query_as(
            "SELECT request_id,action FROM request_deletion_audit WHERE request_id=?",
        )
        .bind(first_id)
        .fetch_one(&state.db)
        .await
        .expect("deletion audit row");
        assert_eq!(audit, (first_id, "individual-owner-delete".to_owned()));
        let audit_columns: Vec<String> = sqlx::query_scalar(
            "SELECT name FROM pragma_table_info('request_deletion_audit') ORDER BY cid",
        )
        .fetch_all(&state.db)
        .await
        .expect("audit table columns");
        assert_eq!(
            audit_columns,
            vec!["id", "request_id", "deleted_at", "action"]
        );
        assert!(second_id > first_id);
    }

    #[tokio::test]
    async fn forty_concurrent_valid_requests_are_all_saved_once() {
        use axum::body::to_bytes;
        use std::collections::HashSet;
        use tokio::task::JoinSet;

        let dir = TempDir::new().expect("temporary app directory");
        fs::write(
            dir.path().join("index.html"),
            "<!doctype html><title>test</title>",
        )
        .expect("write static test page");
        let state = test_state(&dir).await;
        let token: String = sqlx::query_scalar("SELECT token FROM clients LIMIT 1")
            .fetch_one(&state.db)
            .await
            .expect("seeded opaque client token");
        assert_ne!(token, "demo-client");
        assert!(token.len() >= 32);
        let app = app(state.clone(), dir.path().to_path_buf());
        let mut tasks = JoinSet::new();
        for index in 0..40 {
            let service = app.clone();
            let path = format!("/api/catalog/{token}/requests");
            let payload = serde_json::json!({
                "name": format!("Concurrent {index}"),
                "email": format!("concurrent{index}@example.test"),
                "items": [{"product_id": 1, "quantity": 1}]
            });
            tasks.spawn(async move {
                let request = Request::builder()
                    .method("POST")
                    .uri(path)
                    .header("content-type", "application/json")
                    .header("x-forwarded-for", format!("203.0.113.{}", index + 1))
                    .body(Body::from(payload.to_string()))
                    .expect("concurrent request");
                service.oneshot(request).await.expect("request response")
            });
        }
        let mut references = HashSet::new();
        while let Some(result) = tasks.join_next().await {
            let response = result.expect("request task");
            assert_eq!(response.status(), StatusCode::OK);
            let bytes = to_bytes(response.into_body(), 4096)
                .await
                .expect("response body");
            let json: serde_json::Value = serde_json::from_slice(&bytes).expect("JSON response");
            references.insert(json["reference"].as_str().expect("reference").to_owned());
        }
        assert_eq!(references.len(), 40);
        let saved: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM requests")
            .fetch_one(&state.db)
            .await
            .expect("saved request count");
        assert_eq!(saved, 40);
    }
}
