// src-tauri/src/models/user.rs

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum UserRole {
    Admin,
    Staff,
    Kitchen,
}

impl UserRole {
    pub fn as_str(&self) -> &'static str {
        match self {
            UserRole::Admin   => "ADMIN",
            UserRole::Staff   => "STAFF",
            UserRole::Kitchen => "KITCHEN",
        }
    }
}

impl TryFrom<String> for UserRole {
    type Error = String;
    fn try_from(s: String) -> Result<Self, Self::Error> {
        match s.as_str() {
            "ADMIN"   => Ok(UserRole::Admin),
            "STAFF"   => Ok(UserRole::Staff),
            "KITCHEN" => Ok(UserRole::Kitchen),
            other     => Err(format!("Unknown role: {other}")),
        }
    }
}

/// Outbound — never exposes password_hash
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct User {
    pub id:            String,
    pub restaurant_id: String,
    pub name:          String,
    pub email:         String,
    pub role:          UserRole,
    pub created_at:    i64,
    pub updated_at:    i64,
    pub deleted_at:    Option<i64>,
}

/// Inbound from frontend
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthPayload {
    pub email:    String,
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthResult {
    pub user:  User,
    pub token: String,   // stored in OS Keychain, returned once
}
