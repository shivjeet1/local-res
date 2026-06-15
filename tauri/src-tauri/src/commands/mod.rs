// src-tauri/src/commands/mod.rs
// Every public function here = one invoke() call from Next.js.
// Rule: NEVER return raw DB types. Always wrap in ApiResponse<T>.
// Rule: All blocking DB work uses tauri::async_runtime::spawn_blocking.

pub mod orders;
pub mod products;
pub mod auth;
pub mod printer;
pub mod export;
