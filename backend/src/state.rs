use minijinja::Environment;
use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{Arc, Mutex},
};
use tauri::async_runtime::RwLock;
use tokio::process::Child;
use uuid::Uuid;

use crate::runtime::{exec_log::ExecLogHandle, pty_store::PtyStoreHandle};

pub(crate) struct AtuinState {
    // Mutex for that interior mutability
    // We can also just clone these
    // This is pretty gross. But I've found that trying to do too much inside of the state init
    // leads to a really sad Tauri.
    // So
    // 1. Manage the state, provide simple values
    // 2. Initialize the state in the init function
    // Annoying that it needs to be done in two steps, but ok.
    pty_store: Mutex<Option<PtyStoreHandle>>,
    exec_log: Mutex<Option<ExecLogHandle>>,

    // the second rwlock could probs be a mutex
    // i cba it works fine
    pub child_processes: Arc<RwLock<HashMap<uuid::Uuid, Arc<RwLock<Child>>>>>,

    /// Map a runbook id, to a Jinja environment
    /// In the future it may make sense to map to our own abstracted
    /// environment state, but atm this is fine.
    pub template_state: RwLock<HashMap<Uuid, Arc<Environment<'static>>>>,

    // Persisted to the keychain, but cached here so that
    // we don't keep asking the user for keychain access.
    // Map of user -> password
    // Service is hardcoded
    pub runbooks_api_token: RwLock<HashMap<String, String>>,

    // The prefix to use for SQLite and local storage in development mode
    pub dev_prefix: Option<String>,

    pub app_path: PathBuf,

    // Map of runbook -> output variable -> output value
    // All strings
    // I'd like to store the output of all executions in a local sqlite next, but
    // to start lets just store the latest value
    pub runbook_output_variables: Arc<RwLock<HashMap<String, HashMap<String, String>>>>,
}

impl AtuinState {
    pub fn new(dev_prefix: Option<String>, app_path: PathBuf) -> Self {
        Self {
            pty_store: Mutex::new(None),
            exec_log: Mutex::new(None),
            child_processes: Default::default(),
            template_state: Default::default(),
            runbooks_api_token: Default::default(),
            runbook_output_variables: Default::default(),
            dev_prefix,
            app_path,
        }
    }
    pub fn init(&self) {
        let path = if let Some(ref prefix) = self.dev_prefix {
            self.app_path.join(format!("{}_exec_log.db", prefix))
        } else {
            self.app_path.join("exec_log.db")
        };

        // For some reason we cannot spawn the exec log task before the state is managed. Annoying.
        let exec_log = ExecLogHandle::new(path).expect("Failed to boot exec log");
        self.exec_log.lock().unwrap().replace(exec_log);

        let pty_store = PtyStoreHandle::new();
        self.pty_store.lock().unwrap().replace(pty_store);
    }

    pub fn exec_log(&self) -> ExecLogHandle {
        if let Some(exec_log) = &self.exec_log.lock().unwrap().as_ref() {
            (*exec_log).clone()
        } else {
            panic!("Exec log not initialized");
        }
    }

    pub fn pty_store(&self) -> PtyStoreHandle {
        if let Some(pty_store) = &self.pty_store.lock().unwrap().as_ref() {
            (*pty_store).clone()
        } else {
            panic!("Pty store not initialized");
        }
    }
}
