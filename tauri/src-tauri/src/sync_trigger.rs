// src-tauri/src/sync_trigger.rs
//
// Lives in its own module (rather than inline in main.rs) because this
// source tree is compiled twice — once as the `main.rs` binary crate root,
// once as the `lib.rs` library crate root (Tauri v2's mobile-compatible
// scaffold). A type defined directly in main.rs only exists under the binary
// crate's `crate::` path; commands/orders.rs is shared by both crate roots,
// so anything it references via `crate::` must be declared identically by
// both `main.rs` and `lib.rs` (see the `mod sync_trigger;` line in each).

/// A fire-and-forget channel: any command that mutates local data sends `()`
/// here. A background task debounces the stream and fires a sync cycle soon
/// after, rather than waiting up to 30 s for the periodic ticker. Capacity
/// of 8 is enough — drops are fine, the next timer tick or the next write
/// will trigger sync instead.
pub struct SyncTrigger(pub tokio::sync::mpsc::Sender<()>);
