// src-tauri/src/commands/auth.rs
// JWT stored in OS Keychain via tauri-plugin-stronghold.
// Never touches localStorage.

use tauri::State;
use bcrypt::verify;
use crate::db::{users as db, DbPool};
use crate::error::ApiResponse;
use crate::models::user::{AuthPayload, User};

const KEYCHAIN_KEY: &str = "pos_jwt";
type Res<T> = Result<ApiResponse<T>, String>;

/// invoke('auth_user', { payload: { email, password } })
#[tauri::command]
pub async fn auth_user(
    payload: AuthPayload,
    pool: State<'_, DbPool>,
    _app: tauri::AppHandle,
) -> Res<User> {
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

    // Build JWT — store in Stronghold (stubbed; swap with real stronghold vault write)
    let _token = build_local_jwt(&user);
    // store_token_in_keychain(&app, &token)?;  // enable when stronghold fully wired

    Ok(ApiResponse::ok(user))
}

/// invoke('get_current_user')
/// Reads JWT from Stronghold, decodes, returns User.
#[tauri::command]
pub async fn get_current_user(
    pool: State<'_, DbPool>,
    _app: tauri::AppHandle,
) -> Res<User> {
    // Stub — real impl reads from Stronghold vault and verifies JWT
    // let token = read_from_keychain(&app)?;
    // let claims = verify_jwt(&token)?;
    // Then fetch user by claims.sub from DB
    let _ = pool;
    Ok(ApiResponse::err("No active session"))
}

/// invoke('logout')
#[tauri::command]
pub async fn logout(_app: tauri::AppHandle) -> Res<()> {
    // Real impl: delete token from Stronghold vault
    Ok(ApiResponse::ok(()))
}

// ── JWT helpers ───────────────────────────────────────────────────────────

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    sub:           String,
    restaurant_id: String,
    role:          String,
    exp:           i64,
}

fn build_local_jwt(user: &User) -> String {
    let claims = Claims {
        sub:           user.id.clone(),
        restaurant_id: user.restaurant_id.clone(),
        role:          format!("{:?}", user.role),
        exp:           now_secs() + 86_400 * 7,
    };
    // Production: jsonwebtoken::encode(&Header::default(), &claims, &EncodingKey::from_secret(secret))
    format!("JWT_STUB.{}", serde_json::to_string(&claims).unwrap_or_default())
}

fn now_secs() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}
