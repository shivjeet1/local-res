// src-tauri/src/auth_state.rs
//
// Minimal, process-lifetime session holder.
//
// Scope note: the full fix here is "finish the Stronghold auth stub" (encrypt
// the JWT into the OS-backed vault so it survives app restarts). That's a
// real feature in its own right — vault unlock UX, key derivation, migration
// of any session created before Stronghold was wired up, etc. This module
// intentionally does the smaller thing: hold the session in memory for the
// life of the running process, which is enough to unblock the sync ticker
// (root cause 2) without taking on that larger scope. Swapping this for a
// real Stronghold-backed store later is a drop-in replacement — every other
// piece of this fix (the ticker, trigger_sync, the debounced-on-write calls)
// reads through `AuthState`, not through Stronghold directly.

use std::sync::Mutex;
use crate::models::user::User;

/// Everything the sync engine needs to talk to the cloud for the current
/// device/session. `jwt` is `None` when the device authenticated purely
/// locally and has no cloud-verifiable token yet (e.g. logged in while
/// offline) — the ticker treats that as "skip this tick, nothing to sync
/// against," which is the correct offline-first behavior rather than an
/// error.
#[derive(Debug, Clone)]
pub struct SessionInfo {
    pub user:          User,
    pub restaurant_id: String,
    pub device_id:     String,
    pub jwt:           Option<String>,
}

#[derive(Default)]
pub struct AuthState(pub Mutex<Option<SessionInfo>>);

impl AuthState {
    pub fn set(&self, session: SessionInfo) {
        let mut guard = self.0.lock().expect("auth state mutex poisoned");
        *guard = Some(session);
    }

    pub fn clear(&self) {
        let mut guard = self.0.lock().expect("auth state mutex poisoned");
        *guard = None;
    }

    pub fn get(&self) -> Option<SessionInfo> {
        self.0.lock().expect("auth state mutex poisoned").clone()
    }

    /// Convenience for the sync ticker: only returns Some when there's both
    /// an active session AND a usable cloud JWT.
    pub fn cloud_credentials(&self) -> Option<(String, String, String)> {
        let session = self.get()?;
        let jwt = session.jwt?;
        Some((session.restaurant_id, session.device_id, jwt))
    }
}
