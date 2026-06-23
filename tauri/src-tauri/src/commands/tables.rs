// src-tauri/src/commands/tables.rs
use tauri::State;
use crate::db::{tables as db, DbPool};
use crate::error::ApiResponse;
use crate::models::product::RestaurantTable;

type Res<T> = Result<ApiResponse<T>, String>;

#[tauri::command]
pub async fn fetch_tables(
    restaurant_id: String,
    pool: State<'_, DbPool>,
) -> Res<Vec<RestaurantTable>> {
    let pool = pool.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let conn = pool.get().map_err(|e| e.to_string())?;
        db::list_tables(&*conn, &restaurant_id)
            .map(ApiResponse::ok)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}
