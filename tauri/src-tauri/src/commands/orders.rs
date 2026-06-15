// src-tauri/src/commands/orders.rs
use tauri::State;
use crate::db::{orders as db, DbPool};
use crate::error::ApiResponse;
use crate::models::order::{
    AddItemPayload, CreateOrderPayload, Order, UpdateOrderStatusPayload,
};

type Res<T> = Result<ApiResponse<T>, String>;

#[tauri::command]
pub async fn list_open_orders(restaurant_id: String, pool: State<'_, DbPool>) -> Res<Vec<Order>> {
    let pool = pool.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let conn = pool.get().map_err(|e| e.to_string())?;
        db::list_open_orders(&*conn, &restaurant_id)
            .map(ApiResponse::ok)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_order(id: String, pool: State<'_, DbPool>) -> Res<Order> {
    let pool = pool.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let conn = pool.get().map_err(|e| e.to_string())?;
        db::get_order(&*conn, &id)
            .map(ApiResponse::ok)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn save_order_locally(
    restaurant_id: String,
    user_id: String,
    device_id: String,
    payload: CreateOrderPayload,
    pool: State<'_, DbPool>,
) -> Res<Order> {
    let pool = pool.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let conn = pool.get().map_err(|e| e.to_string())?;
        db::create_order(&*conn, &restaurant_id, &user_id, &device_id, &payload)
            .map(ApiResponse::ok)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn add_order_item(
    restaurant_id: String,
    device_id: String,
    payload: AddItemPayload,
    pool: State<'_, DbPool>,
) -> Res<Order> {
    let pool = pool.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let conn = pool.get().map_err(|e| e.to_string())?;
        db::add_item(&*conn, &restaurant_id, &device_id, &payload)
            .map(ApiResponse::ok)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn remove_order_item(
    order_id: String,
    item_id: String,
    pool: State<'_, DbPool>,
) -> Res<Order> {
    let pool = pool.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let conn = pool.get().map_err(|e| e.to_string())?;
        db::remove_item(&*conn, &order_id, &item_id)
            .map(ApiResponse::ok)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn update_order_status(
    payload: UpdateOrderStatusPayload,
    pool: State<'_, DbPool>,
) -> Res<Order> {
    let pool = pool.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let conn = pool.get().map_err(|e| e.to_string())?;
        db::update_order_status(&*conn, &payload)
            .map(ApiResponse::ok)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn void_order(order_id: String, pool: State<'_, DbPool>) -> Res<()> {
    let pool = pool.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let conn = pool.get().map_err(|e| e.to_string())?;
        db::void_order(&*conn, &order_id)
            .map(|_| ApiResponse::ok(()))
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}
