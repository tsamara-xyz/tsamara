//! Read-only HTTP API over the SQLite store.

use crate::{classify::Config, store, Db};
use axum::{
    extract::{Query, State},
    http::{header::ACCESS_CONTROL_ALLOW_ORIGIN, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use std::collections::HashMap;

/// JSON readable from any origin; a database error becomes a 500.
fn json<T: serde::Serialize>(body: rusqlite::Result<T>) -> Response {
    match body {
        Ok(body) => ([(ACCESS_CONTROL_ALLOW_ORIGIN, "*")], Json(body)).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

pub fn router(cfg: Config, db: Db) -> Router {
    Router::new()
        .route("/series", get(move || async move { json(Ok(cfg)) }))
        .route(
            "/holders",
            get(|State(db): State<Db>| async move { json(store::holders(&db.lock().unwrap())) }),
        )
        .route(
            "/events",
            get(
                |State(db): State<Db>, Query(q): Query<HashMap<String, String>>| async move {
                    json(store::events(&db.lock().unwrap(), q.get("wallet").map(String::as_str)))
                },
            ),
        )
        .with_state(db)
}
