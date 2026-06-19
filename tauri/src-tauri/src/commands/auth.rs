// src-tauri/src/commands/auth.rs
// Session held in-memory for the process lifetime (see auth_state.rs for why
// this isn't the full Stronghold vault yet). Local login always works
// offline; a cloud JWT is fetched best-effort so the sync engine has
// something to authenticate with once the device is online.

use tauri::State;
use bcrypt::verify;
use crate::auth_state::{AuthState, SessionInfo};
use crate::db::{users as db, DbPool};
use crate::error::ApiResponse;
use crate::models::user::{AuthPayload, User};
use crate::sync::CLOUD_BASE;

type Res<T> = Result<ApiResponse<T>, String>;

/// invoke('auth_user', { payload: { email, password } })
#[tauri::command]
pub async fn auth_user(
    payload: AuthPayload,
    pool: State<'_, DbPool>,
    auth: State<'_, AuthState>,
) -> Res<crate::models::user::AuthResult> {
    if payload.email.trim().is_empty() || payload.password.is_empty() {
        return Ok(ApiResponse::err("Email and password required"));
    }

    let pool = pool.inner().clone();
    let email = payload.email.clone();

    let (user, hash) = tauri::async_runtime::spawn_blocking(move || {
        let conn = pool.get().map_err(|e| e.to_string())?;
        db::get_user_with_hash(&*conn, &email).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())??;

    let password = payload.password.clone();
    let valid = tauri::async_runtime::spawn_blocking(move || {
        verify(&password, &hash).unwrap_or(false)
    })
    .await
    .map_err(|e| e.to_string())?;

    if !valid {
        return Ok(ApiResponse::err("Invalid credentials"));
    }

    let jwt = fetch_cloud_jwt(&payload.email, &payload.password).await;

    auth.set(SessionInfo {
        user: user.clone(),
        restaurant_id: user.restaurant_id.clone(),
        device_id: device_id_for_this_machine(),
        jwt: jwt.clone(),
    });

    Ok(ApiResponse::ok(crate::models::user::AuthResult {
        user,
        token: jwt,
    }))
}

/// invoke('get_current_user')
/// Reads the in-memory session set by a prior auth_user call.
#[tauri::command]
pub async fn get_current_user(auth: State<'_, AuthState>) -> Res<User> {
    match auth.get() {
        Some(session) => Ok(ApiResponse::ok(session.user)),
        None => Ok(ApiResponse::err("No active session")),
    }
}

/// invoke('logout')
#[tauri::command]
pub async fn logout(auth: State<'_, AuthState>) -> Res<()> {
    auth.clear();
    Ok(ApiResponse::ok(()))
}

// ── Cloud JWT fetch (best-effort) ────────────────────────────────────────

#[derive(serde::Deserialize)]
struct CloudLoginData {
    token: String,
}

#[derive(serde::Deserialize)]
struct CloudLoginResponse {
    success: bool,
    data: Option<CloudLoginData>,
}

/// Calls the real backend's POST /auth/login to get a token signed with the
/// backend's JWT_SECRET — the only kind of token /sync/push and /sync/pull
/// will actually accept. Returns None on any failure (offline, wrong creds
/// server-side, backend down) rather than erroring the whole login, since
/// local SQLite auth is the source of truth for whether this device's user
/// can use this terminal.
async fn fetch_cloud_jwt(email: &str, password: &str) -> Option<String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .ok()?;

    let res = client
        .post(format!("{CLOUD_BASE}/auth/login"))
        .json(&serde_json::json!({ "email": email, "password": password }))
        .send()
        .await
        .ok()?;

    if !res.status().is_success() {
        return None;
    }

    let body: CloudLoginResponse = res.json().await.ok()?;
    if !body.success {
        return None;
    }
    body.data.map(|d| d.token)
}

// ── Helpers ───────────────────────────────────────────────────────────────

/// Stand-in for a real per-installation device id. Production: generate
/// once on first run (e.g. a UUID) and persist it in the app data dir, so it
/// survives restarts and uniquely identifies this physical terminal to the
/// sync engine. Out of scope for this fix — push_dirty/pull_from_cloud and
/// every order command already take device_id as an explicit argument from
/// the frontend, so this only matters for the ticker's automatic calls.
fn device_id_for_this_machine() -> String {
    "device_local_01".to_string()
}
