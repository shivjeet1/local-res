// src-tauri/src/commands/products.rs
use tauri::State;
use crate::db::{products as db, DbPool};
use crate::error::ApiResponse;
use crate::models::product::{CreateProductPayload, Product};

type Res<T> = Result<ApiResponse<T>, String>;

#[tauri::command]
pub async fn fetch_menu(
    restaurant_id: String,
    pool: State<'_, DbPool>,
) -> Res<serde_json::Value> {
    let pool = pool.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let conn = pool.get().map_err(|e| e.to_string())?;
        let categories = db::list_categories(&*conn, &restaurant_id).map_err(|e| e.to_string())?;
        let products   = db::list_products(&*conn, &restaurant_id).map_err(|e| e.to_string())?;
        Ok(ApiResponse::ok(serde_json::json!({
            "categories": categories,
            "products":   products,
        })))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn create_product(
    restaurant_id: String,
    payload: CreateProductPayload,
    pool: State<'_, DbPool>,
) -> Res<Product> {
    let pool = pool.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let conn = pool.get().map_err(|e| e.to_string())?;
        db::create_product(&*conn, &restaurant_id, &payload)
            .map(ApiResponse::ok)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn delete_product(id: String, pool: State<'_, DbPool>) -> Res<()> {
    let pool = pool.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let conn = pool.get().map_err(|e| e.to_string())?;
        db::delete_product(&*conn, &id)
            .map(|_| ApiResponse::ok(()))
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}
