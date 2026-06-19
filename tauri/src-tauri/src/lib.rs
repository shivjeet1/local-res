// src-tauri/src/lib.rs
// Required by Tauri v2 for the library crate target.
// All app logic lives in main.rs; this re-exports for the build system.

mod auth_state;
mod commands;
mod db;
mod error;
mod models;
mod sync;
