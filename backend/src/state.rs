use minijinja::Environment;
use std::{collections::HashMap, sync::Arc};
use tauri::async_runtime::RwLock;

use crate::pty::Pty;

#[derive(Default)]
pub(crate) struct AtuinState {
    pub pty_sessions: Arc<RwLock<HashMap<uuid::Uuid, Pty>>>,

    /// Map a runbook id, to a Jinja environment
    /// In the future it may make sense to map to our own abstracted
    /// environment state, but atm this is fine.
    pub template_state: RwLock<HashMap<String, Arc<Environment<'static>>>>,

    // Persisted to the keychain, but cached here so that
    // we don't keep asking the user for keychain access.
    // Map of user -> password
    // Service is hardcoded
    pub runbooks_api_token: RwLock<HashMap<String, String>>,

    // The prefix to use for SQLite and local storage in development mode
    pub dev_prefix: Option<String>,
}
