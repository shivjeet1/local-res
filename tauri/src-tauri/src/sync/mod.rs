// src-tauri/src/sync/mod.rs
// LWW sync engine. All HTTP = Rust only. Frontend never calls cloud.
//
// Push: SELECT dirty rows → POST /sync/push → mark _synced=1
// Pull: GET /sync/pull?since={checkpoint} → upsert rows → update checkpoint

use rusqlite::params;
use serde::{Deserialize, Serialize};
use crate::db::{DbPool, now_ms};

pub(crate) const CLOUD_BASE: &str = "https://api.yourpos.app";
const BATCH_SIZE: usize = 200;

// ── Push ──────────────────────────────────────────────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PushBatch {
    device_id:     String,
    restaurant_id: String,
    orders:        Vec<serde_json::Value>,
    order_items:   Vec<serde_json::Value>,
    products:      Vec<serde_json::Value>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PushAck {
    synced_ids:   Vec<String>,
    #[allow(dead_code)]
    conflict_ids: Vec<String>,
}

pub async fn push_dirty(
    pool: DbPool,
    device_id: String,
    restaurant_id: String,
    jwt: String,
) -> Result<usize, String> {
    let pool2 = pool.clone();
    // Clone before move into closure
    let rid_for_closure = restaurant_id.clone();

    let (orders, items, products) = tauri::async_runtime::spawn_blocking(move || {
        let conn = pool2.get().map_err(|e| e.to_string())?;
        Ok::<_, String>((
            fetch_dirty_rows(&*conn, "orders",      &rid_for_closure, BATCH_SIZE)?,
            fetch_dirty_rows(&*conn, "order_items", &rid_for_closure, BATCH_SIZE)?,
            fetch_dirty_rows(&*conn, "products",    &rid_for_closure, BATCH_SIZE)?,
        ))
    })
    .await
    .map_err(|e| e.to_string())??;

    let total = orders.len() + items.len() + products.len();
    if total == 0 { return Ok(0); }

    let batch = PushBatch {
        device_id:     device_id.clone(),
        restaurant_id: restaurant_id.clone(),   // still valid — only closure took clone
        orders,
        order_items: items,
        products,
    };

    let client = reqwest::Client::new();
    let res = client
        .post(format!("{CLOUD_BASE}/sync/push"))
        .bearer_auth(&jwt)
        .json(&batch)
        .send()
        .await
        .map_err(|e| format!("Push HTTP error: {e}"))?;

    if !res.status().is_success() {
        return Err(format!("Push rejected: {}", res.status()));
    }

    let ack: PushAck = res.json().await.map_err(|e| format!("Push parse error: {e}"))?;
    let synced_now = now_ms();

    tauri::async_runtime::spawn_blocking(move || {
        let conn = pool.get().map_err(|e| e.to_string())?;
        mark_synced(&*conn, &ack.synced_ids, synced_now)
    })
    .await
    .map_err(|e| e.to_string())??;

    Ok(total)
}

// ── Pull ──────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PullResponse {
    orders:      Vec<serde_json::Value>,
    order_items: Vec<serde_json::Value>,
    products:    Vec<serde_json::Value>,
    server_ts:   i64,
}

pub async fn pull_from_cloud(
    pool: DbPool,
    restaurant_id: String,
    jwt: String,
) -> Result<usize, String> {
    let pool2 = pool.clone();
    let checkpoint = tauri::async_runtime::spawn_blocking(move || {
        let conn = pool2.get().map_err(|e| e.to_string())?;
        get_checkpoint(&*conn, "orders")
    })
    .await
    .map_err(|e| e.to_string())??;

    let client = reqwest::Client::new();
    let res = client
        .get(format!("{CLOUD_BASE}/sync/pull"))
        .bearer_auth(&jwt)
        .query(&[
            ("since", checkpoint.to_string()),
            ("restaurantId", restaurant_id.clone()),
        ])
        .send()
        .await
        .map_err(|e| format!("Pull HTTP error: {e}"))?;

    if !res.status().is_success() {
        return Err(format!("Pull rejected: {}", res.status()));
    }

    let pull: PullResponse = res.json().await.map_err(|e| format!("Pull parse error: {e}"))?;
    let total = pull.orders.len() + pull.order_items.len() + pull.products.len();

    tauri::async_runtime::spawn_blocking(move || {
        let conn = pool.get().map_err(|e| e.to_string())?;
        upsert_pulled_rows(&*conn, "orders",      &pull.orders,      pull.server_ts)?;
        upsert_pulled_rows(&*conn, "order_items", &pull.order_items, pull.server_ts)?;
        upsert_pulled_rows(&*conn, "products",    &pull.products,    pull.server_ts)?;
        Ok::<_, String>(())
    })
    .await
    .map_err(|e| e.to_string())??;

    Ok(total)
}

// ── Tauri command ─────────────────────────────────────────────────────────

#[tauri::command]
pub async fn trigger_sync(
    restaurant_id: String,
    device_id:     String,
    jwt:           String,
    pool: tauri::State<'_, DbPool>,
) -> Result<crate::error::ApiResponse<serde_json::Value>, String> {
    let p = pool.inner().clone();
    let pushed = push_dirty(p.clone(), device_id, restaurant_id.clone(), jwt.clone()).await?;
    let pulled = pull_from_cloud(p, restaurant_id, jwt).await?;

    Ok(crate::error::ApiResponse::ok(serde_json::json!({
        "pushed": pushed,
        "pulled": pulled,
    })))
}

// ── SQLite helpers ────────────────────────────────────────────────────────

fn fetch_dirty_rows(
    conn: &rusqlite::Connection,
    table: &str,
    restaurant_id: &str,
    limit: usize,
) -> Result<Vec<serde_json::Value>, String> {
    let sql = format!(
        "SELECT * FROM {table} WHERE _synced = 0 AND restaurant_id = ?1 LIMIT ?2"
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let col_names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();

    let rows = stmt
        .query_map(params![restaurant_id, limit as i64], |row| {
            let mut map = serde_json::Map::new();
            for (i, col) in col_names.iter().enumerate() {
                let val: rusqlite::types::Value = row.get(i)?;
                map.insert(col.clone(), rusqlite_value_to_json(val));
            }
            Ok(serde_json::Value::Object(map))
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

fn mark_synced(conn: &rusqlite::Connection, ids: &[String], synced_at: i64) -> Result<(), String> {
    for table in &["orders", "order_items", "products", "users", "categories"] {
        for id in ids {
            let sql = format!(
                "UPDATE {table} SET _synced = 1, synced_at = ?1 WHERE id = ?2"
            );
            conn.execute(&sql, params![synced_at, id]).ok();
        }
    }
    Ok(())
}

fn upsert_pulled_rows(
    conn: &rusqlite::Connection,
    table: &str,
    rows: &[serde_json::Value],
    server_ts: i64,
) -> Result<(), String> {
    for row in rows {
        let id = row["id"].as_str().unwrap_or_default();
        let remote_updated: i64 = row["updatedAt"].as_i64().unwrap_or(0);

        let sql = format!("SELECT updated_at FROM {table} WHERE id = ?1");
        let local_updated: i64 = conn
            .query_row(&sql, params![id], |r| r.get(0))
            .unwrap_or(0);

        if remote_updated <= local_updated { continue; }

        let cols: Vec<String> = row
            .as_object()
            .map(|m| m.keys().cloned().collect())
            .unwrap_or_default();

        if cols.is_empty() { continue; }

        let col_list  = cols.join(", ");
        let ph_list: Vec<String> = (1..=cols.len()).map(|i| format!("?{i}")).collect();
        let updates: Vec<String> = cols.iter()
            .filter(|c| c.as_str() != "id")
            .map(|c| format!("{c} = excluded.{c}"))
            .collect();

        let sql = format!(
            "INSERT INTO {table} ({col_list}) VALUES ({})
             ON CONFLICT(id) DO UPDATE SET {}, _synced = 1, synced_at = {server_ts}",
            ph_list.join(", "),
            updates.join(", ")
        );

        let values: Vec<rusqlite::types::Value> =
            cols.iter().map(|k| json_to_rusqlite_value(&row[k])).collect();

        conn.execute(&sql, rusqlite::params_from_iter(values.iter()))
            .map_err(|e| format!("Upsert {table}/{id}: {e}"))?;
    }

    update_checkpoint(conn, table, server_ts).ok();
    Ok(())
}

fn get_checkpoint(conn: &rusqlite::Connection, entity: &str) -> Result<i64, String> {
    conn.query_row(
        "SELECT last_pulled_at FROM sync_checkpoints WHERE entity = ?1",
        params![entity],
        |r| r.get(0),
    )
    .map_err(|e| e.to_string())
}

fn update_checkpoint(conn: &rusqlite::Connection, entity: &str, ts: i64) -> Result<(), String> {
    conn.execute(
        "UPDATE sync_checkpoints SET last_pulled_at = ?1 WHERE entity = ?2",
        params![ts, entity],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn rusqlite_value_to_json(v: rusqlite::types::Value) -> serde_json::Value {
    match v {
        rusqlite::types::Value::Null      => serde_json::Value::Null,
        rusqlite::types::Value::Integer(i)=> serde_json::json!(i),
        rusqlite::types::Value::Real(f)   => serde_json::json!(f),
        rusqlite::types::Value::Text(s)   => serde_json::json!(s),
        rusqlite::types::Value::Blob(b)   => serde_json::json!(b),
    }
}

fn json_to_rusqlite_value(v: &serde_json::Value) -> rusqlite::types::Value {
    match v {
        serde_json::Value::Null       => rusqlite::types::Value::Null,
        serde_json::Value::Bool(b)    => rusqlite::types::Value::Integer(*b as i64),
        serde_json::Value::Number(n)  => {
            if let Some(i) = n.as_i64() { rusqlite::types::Value::Integer(i) }
            else if let Some(f) = n.as_f64() { rusqlite::types::Value::Real(f) }
            else { rusqlite::types::Value::Null }
        }
        serde_json::Value::String(s)  => rusqlite::types::Value::Text(s.clone()),
        _                             => rusqlite::types::Value::Null,
    }
}
