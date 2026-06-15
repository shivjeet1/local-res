// src-tauri/src/commands/export.rs
use crate::db::DbPool;
use crate::error::ApiResponse;
use rusqlite::params;
use std::path::PathBuf;
use tauri::State;

type Res<T> = Result<ApiResponse<T>, String>;

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportOrdersPayload {
    pub restaurant_id: String,
    pub from_ts:       i64,
    pub to_ts:         i64,
    pub output_dir:    String,
}

#[tauri::command]
pub async fn export_orders_csv(
    payload: ExportOrdersPayload,
    pool: State<'_, DbPool>,
) -> Res<String> {
    let pool = pool.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let conn = pool.get().map_err(|e| e.to_string())?;
        let conn = &*conn;

        let mut stmt = conn.prepare(
            "SELECT o.id, o.created_at, o.total_cents, o.subtotal_cents, o.tax_cents,
                    o.status, o.device_id, COUNT(oi.id) AS item_count
             FROM orders o
             LEFT JOIN order_items oi ON oi.order_id = o.id AND oi.deleted_at IS NULL
             WHERE o.restaurant_id = ?1
               AND o.created_at BETWEEN ?2 AND ?3
               AND o.deleted_at IS NULL
             GROUP BY o.id
             ORDER BY o.created_at ASC",
        ).map_err(|e| e.to_string())?;

        let rows = stmt.query_map(
            params![payload.restaurant_id, payload.from_ts, payload.to_ts],
            |r| Ok((
                r.get::<_, String>(0)?,
                r.get::<_, i64>(1)?,
                r.get::<_, i64>(2)?,
                r.get::<_, i64>(3)?,
                r.get::<_, i64>(4)?,
                r.get::<_, String>(5)?,
                r.get::<_, String>(6)?,
                r.get::<_, i64>(7)?,
            )),
        ).map_err(|e| e.to_string())?;

        let mut csv = String::from(
            "order_id,created_at_ms,status,items,subtotal_rs,gst_rs,total_rs,device_id\n"
        );
        let mut count = 0;
        for row in rows {
            let (id, ts, total, sub, tax, status, device, items) =
                row.map_err(|e| e.to_string())?;
            csv.push_str(&format!(
                "{},{},{},{},{:.2},{:.2},{:.2},{}\n",
                id, ts, status, items,
                sub   as f64 / 100.0,
                tax   as f64 / 100.0,
                total as f64 / 100.0,
                device,
            ));
            count += 1;
        }
        if count == 0 { return Err("No orders found in range".into()); }

        let filename = format!("orders_export_{}.csv", payload.from_ts);
        let out_path = PathBuf::from(&payload.output_dir).join(&filename);
        std::fs::write(&out_path, csv.as_bytes()).map_err(|e| format!("Write failed: {e}"))?;
        Ok(ApiResponse::ok(out_path.to_string_lossy().to_string()))
    })
    .await
    .map_err(|e| e.to_string())?
}
