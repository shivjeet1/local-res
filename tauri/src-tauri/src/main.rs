// src-tauri/src/main.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod db;
mod error;
mod models;
mod sync;

use std::path::PathBuf;
use std::time::Duration;
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_stronghold::Builder::new(|password| {
                // Derive key from password bytes using argon2
                // FIX: Converted &str to Vec<u8>
                argon2_derive_key(password.as_bytes().to_vec())
            })
            .build(),
        )
        .setup(|app| {
            let db_path = app_db_path(app.handle())?;
            let pool = db::init_pool(&db_path)
                .map_err(|e| Box::<dyn std::error::Error>::from(e))?;
            app.manage(pool.clone());

            // Sync ticker — every 30s
            let pool_tick = pool.clone();
            tauri::async_runtime::spawn(async move {
                let mut interval = tokio::time::interval(Duration::from_secs(30));
                loop {
                    interval.tick().await;
                    let _ = &pool_tick;
                    // Production: read jwt from stronghold + call sync::push_dirty / pull_from_cloud
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::auth::auth_user,
            commands::auth::get_current_user,
            commands::auth::logout,
            commands::products::fetch_menu,
            commands::products::create_product,
            commands::products::delete_product,
            commands::orders::list_open_orders,
            commands::orders::get_order,
            commands::orders::save_order_locally,
            commands::orders::add_order_item,
            commands::orders::remove_order_item,
            commands::orders::update_order_status,
            commands::orders::void_order,
            sync::trigger_sync,
            commands::printer::print_receipt,
            commands::export::export_orders_csv,
        ])
        .run(tauri::generate_context!())
        .expect("Tauri app failed to start");
}

fn app_db_path(app: &tauri::AppHandle) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let dir = app.path().app_data_dir()?;
    std::fs::create_dir_all(&dir)?;
    Ok(dir.join("pos.db"))
}

/// Derives a 32-byte key from raw password bytes using Argon2id.
/// Used by tauri-plugin-stronghold to encrypt the vault.
fn argon2_derive_key(password: Vec<u8>) -> Vec<u8> {
    use argon2::Argon2;
    // Fixed salt — in production derive from machine UUID or user-specific value
    let salt = b"pos_terminal_salt_v1"; // must be >= 8 bytes
    let mut output = vec![0u8; 32];
    Argon2::default()
        .hash_password_into(&password, salt, &mut output)
        .expect("Argon2 key derivation failed");
    output
}
