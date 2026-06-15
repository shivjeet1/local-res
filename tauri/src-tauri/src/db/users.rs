// src-tauri/src/db/users.rs
use rusqlite::{params, Connection};
use crate::error::PosError;
use crate::models::user::{User, UserRole};

pub fn get_user_with_hash(conn: &Connection, email: &str) -> Result<(User, String), PosError> {
    conn.query_row(
        "SELECT id, restaurant_id, name, email, role,
                password_hash, created_at, updated_at, deleted_at
         FROM users WHERE email = ?1 AND deleted_at IS NULL",
        params![email],
        |r| {
            let role_str: String = r.get(4)?;
            let hash: String     = r.get(5)?;
            Ok((
                User {
                    id:            r.get(0)?,
                    restaurant_id: r.get(1)?,
                    name:          r.get(2)?,
                    email:         r.get(3)?,
                    role: UserRole::try_from(role_str)
                        .map_err(|e| rusqlite::Error::InvalidParameterName(e))?,
                    created_at:    r.get(6)?,
                    updated_at:    r.get(7)?,
                    deleted_at:    r.get(8)?,
                },
                hash,
            ))
        },
    )
    .map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => PosError::NotFound(format!("User {email}")),
        other => PosError::Database(other),
    })
}

pub fn get_user(conn: &Connection, id: &str) -> Result<User, PosError> {
    conn.query_row(
        "SELECT id, restaurant_id, name, email, role,
                created_at, updated_at, deleted_at
         FROM users WHERE id = ?1 AND deleted_at IS NULL",
        params![id],
        |r| {
            let role_str: String = r.get(4)?;
            Ok(User {
                id:            r.get(0)?,
                restaurant_id: r.get(1)?,
                name:          r.get(2)?,
                email:         r.get(3)?,
                role: UserRole::try_from(role_str)
                    .map_err(|e| rusqlite::Error::InvalidParameterName(e))?,
                created_at:    r.get(5)?,
                updated_at:    r.get(6)?,
                deleted_at:    r.get(7)?,
            })
        },
    )
    .map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => PosError::NotFound(format!("User {id}")),
        other => PosError::Database(other),
    })
}
