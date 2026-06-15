// src-tauri/src/error.rs
// Single error type crossing ALL IPC boundaries.

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum PosError {
    #[error("DB error: {0}")]
    Database(#[from] rusqlite::Error),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Validation: {0}")]
    Validation(String),

    #[error("Auth: {0}")]
    Auth(String),

    #[error("Sync: {0}")]
    Sync(String),

    #[error("IO: {0}")]
    Io(#[from] std::io::Error),

    #[error("Serde: {0}")]
    Serde(#[from] serde_json::Error),
}

// Tauri commands return String errors (serialized).
impl From<PosError> for String {
    fn from(e: PosError) -> Self {
        e.to_string()
    }
}

// ---- Typed envelope every command returns ----

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiResponse<T: Serialize> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
    pub meta: Option<ResponseMeta>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResponseMeta {
    pub total: Option<i64>,
    pub page: Option<i32>,
}

impl<T: Serialize> ApiResponse<T> {
    pub fn ok(data: T) -> Self {
        Self { success: true, data: Some(data), error: None, meta: None }
    }

    pub fn ok_paged(data: T, total: i64) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
            meta: Some(ResponseMeta { total: Some(total), page: None }),
        }
    }

    pub fn err(msg: impl Into<String>) -> Self {
        Self { success: false, data: None, error: Some(msg.into()), meta: None }
    }
}
