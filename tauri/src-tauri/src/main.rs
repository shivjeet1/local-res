// src-tauri/src/main.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod auth_state;
mod commands;
mod db;
mod error;
mod models;
mod sync;
mod sync_trigger;

use std::path::PathBuf;
use std::time::Duration;
use tauri::Manager;
use auth_state::AuthState;
use sync_trigger::SyncTrigger;

fn main() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_stronghold::Builder::new(|password| {
                argon2_derive_key(password.as_bytes().to_vec())
            })
            .build(),
        )
        .setup(|app| {
            // ── Database ─────────────────────────────────────────────────
            let db_path = app_db_path(app.handle())?;
            let pool = db::init_pool(&db_path)
                .map_err(|e| Box::<dyn std::error::Error>::from(e))?;
            app.manage(pool.clone());

            // ── Auth state ───────────────────────────────────────────────
            // In-memory for now (see auth_state.rs for why this isn't the
            // full Stronghold vault yet). Managed so every command can read
            // it via tauri::State<'_, AuthState>.
            app.manage(AuthState::default());

            // ── Debounce channel (trigger-on-write) ──────────────────────
            // Commands that mutate local data call trigger.send(()) so a
            // sync cycle starts ~1 s after the write, not up to 30 s later.
            let (tx, mut rx) = tokio::sync::mpsc::channel::<()>(8);
            app.manage(SyncTrigger(tx));

            // ── Background sync task ─────────────────────────────────────
            let pool_tick = pool.clone();
            let auth_handle = app.handle().clone();

            tauri::async_runtime::spawn(async move {
                // 30 s baseline ticker — fires even with no write activity,
                // so an idle terminal eventually catches up.
                let mut interval = tokio::time::interval(Duration::from_secs(30));
                // After a write arrives on `rx`, wait this long before
                // syncing. Coalesces rapid-fire writes (e.g. adding several
                // items to an order one by one) into a single sync round.
                const DEBOUNCE: Duration = Duration::from_millis(1_200);

                loop {
                    // Wait for either a write trigger or the periodic tick,
                    // whichever comes first.
                    let triggered = tokio::select! {
                        _ = rx.recv() => true,
                        _ = interval.tick() => false,
                    };

                    if triggered {
                        // Drain any extra messages that piled up during the
                        // debounce window, then wait out the window so we
                        // don't spam the cloud on every keystroke.
                        while rx.try_recv().is_ok() {}
                        tokio::time::sleep(DEBOUNCE).await;
                        // Drain again in case more arrived during sleep.
                        while rx.try_recv().is_ok() {}
                    }

                    // Read current credentials — if offline or not logged in
                    // yet, skip this tick silently (correct offline behavior).
                    let auth_state = auth_handle.state::<AuthState>();
                    let Some((restaurant_id, device_id, jwt)) =
                        auth_state.cloud_credentials()
                    else {
                        continue;
                    };

                    let pool = pool_tick.clone();
                    let (rid2, jwt2) = (restaurant_id.clone(), jwt.clone());

                    // Push and pull run sequentially: push first so the
                    // cloud has our latest before we pull (avoids us
                    // immediately getting our own rows back as conflicts).
                    match sync::push_dirty(pool.clone(), device_id, restaurant_id, jwt).await {
                        Ok(n) if n > 0 => log::info!("[sync] pushed {n} rows"),
                        Ok(_)          => {}
                        Err(e)         => log::warn!("[sync] push error: {e}"),
                    }

                    match sync::pull_from_cloud(pool, rid2, jwt2).await {
                        Ok(n) if n > 0 => log::info!("[sync] pulled {n} rows"),
                        Ok(_)          => {}
                        Err(e)         => log::warn!("[sync] pull error: {e}"),
                    }
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
            commands::tables::fetch_tables,
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

fn argon2_derive_key(password: Vec<u8>) -> Vec<u8> {
    use argon2::Argon2;
    let salt = b"pos_terminal_salt_v1";
    let mut output = vec![0u8; 32];
    Argon2::default()
        .hash_password_into(&password, salt, &mut output)
        .expect("Argon2 key derivation failed");
    output
}
