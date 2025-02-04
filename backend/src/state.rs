use minijinja::Environment;
use std::{collections::HashMap, sync::Arc};
use tauri::async_runtime::RwLock;
use tokio::process::Child;

use crate::pty::Pty;

#[derive(Default)]
pub(crate) struct AtuinState {
    pub pty_sessions: Arc<RwLock<HashMap<uuid::Uuid, Pty>>>,

    // the second rwlock could probs be a mutex
    // i cba it works fine
    pub child_processes: Arc<RwLock<HashMap<uuid::Uuid, Arc<RwLock<Child>>>>>,

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

    // Map of runbook -> output variable -> output value
    // All strings
    // I'd like to store the output of all executions in a local sqlite next, but
    // to start lets just store the latest value
    pub runbook_output_variables: Arc<RwLock<HashMap<String, HashMap<String, String>>>>,
}
