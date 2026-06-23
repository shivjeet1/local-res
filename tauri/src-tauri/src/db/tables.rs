// src-tauri/src/db/tables.rs
//
// `restaurant_tables` already existed in the SQLite schema (001_initial.sql)
// with full sync columns, but had no Rust query layer and was never wired
// into the sync engine's pull cycle — so a device would never actually
// receive table rows from the cloud. This module adds the missing read
// layer; sync/mod.rs adds tables to the pull cycle so they actually arrive.

use rusqlite::{params, Connection};
use crate::error::PosError;
use crate::models::product::RestaurantTable;

pub fn list_tables(conn: &Connection, restaurant_id: &str) -> Result<Vec<RestaurantTable>, PosError> {
    let mut stmt = conn.prepare(
        "SELECT id, restaurant_id, label, capacity, created_at, updated_at, deleted_at
         FROM restaurant_tables
         WHERE restaurant_id = ?1 AND deleted_at IS NULL
         ORDER BY label ASC",
    )?;
    let rows = stmt.query_map(params![restaurant_id], |r| {
        Ok(RestaurantTable {
            id:            r.get(0)?,
            restaurant_id: r.get(1)?,
            label:         r.get(2)?,
            capacity:      r.get(3)?,
            created_at:    r.get(4)?,
            updated_at:    r.get(5)?,
            deleted_at:    r.get(6)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(PosError::Database)
}
