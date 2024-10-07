use std::collections::HashMap;
use tauri::async_runtime::RwLock;

use crate::pty::Pty;

#[derive(Default)]
pub(crate) struct AtuinState {
    pub pty_sessions: RwLock<HashMap<uuid::Uuid, Pty>>,

    // Persisted to the keychain, but cached here so that
    // we don't keep asking the user for keychain access.
    // Map of user -> password
    // Service is hardcoded
    pub runbooks_api_token: RwLock<HashMap<String, String>>,
}
