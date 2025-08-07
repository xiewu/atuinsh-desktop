use std::{collections::HashMap, path::PathBuf, sync::Arc, time::Duration};

use notify_debouncer_full::{
    new_debouncer,
    notify::{EventKind, RecommendedWatcher, RecursiveMode},
    DebounceEventResult, DebouncedEvent, Debouncer, RecommendedCache,
};
use serde::Serialize;
use serde_json::Value;
use ts_rs::TS;

use crate::{
    run_async_command,
    workspaces::{
        fs_ops::{FsOps, FsOpsHandle, WorkspaceDirInfo},
        state::WorkspaceState,
    },
};

#[derive(thiserror::Error, TS, Debug, Clone, Serialize)]
#[serde(tag = "type", content = "data")]
#[ts(export, tag = "type", content = "data")]
pub enum WorkspaceError {
    #[error("Failed to process workspace")]
    WorkspaceReadError(PathBuf, String),
}

pub trait OnEvent: Send + Sync + Fn(WorkspaceEvent) {}
impl<F: Send + Sync + Fn(WorkspaceEvent)> OnEvent for F {}

pub struct WorkspaceManager {
    workspaces: HashMap<String, Workspace>,
}

pub struct Workspace {
    state: Result<WorkspaceState, WorkspaceError>,
    path: PathBuf,
    _debouncer: Debouncer<RecommendedWatcher, RecommendedCache>,
    fs_ops: FsOpsHandle,
    on_event: Arc<dyn OnEvent>,
}

#[derive(TS, Debug, Serialize)]
#[serde(tag = "type", content = "data")]
#[ts(tag = "type", content = "data", export)]
pub enum WorkspaceEvent {
    State(WorkspaceState),
    Error(WorkspaceError),
}

impl From<Result<WorkspaceState, WorkspaceError>> for WorkspaceEvent {
    fn from(state: Result<WorkspaceState, WorkspaceError>) -> Self {
        match state {
            Ok(state) => WorkspaceEvent::State(state),
            Err(err) => WorkspaceEvent::Error(err),
        }
    }
}

impl WorkspaceManager {
    pub fn new() -> Self {
        Self {
            workspaces: HashMap::new(),
        }
    }

    pub fn reset(&mut self) {
        // Drop will clean up debouncer and fs_ops
        self.workspaces.clear();
    }

    pub async fn watch_workspace(
        &mut self,
        path: PathBuf,
        id: String,
        on_event: impl OnEvent + 'static,
        // hack: we need to pass the manager to the callback, so we pass in
        // a clone of the manager Arc from the Tauri state
        manager_clone: Arc<tokio::sync::Mutex<Option<WorkspaceManager>>>,
    ) -> Result<(), String> {
        if self.workspaces.contains_key(&id) {
            return Err(format!("Workspace with id {} already watched", id));
        }

        let on_event = Arc::new(on_event);

        let id_clone = id.clone();
        let mut debouncer = new_debouncer(
            Duration::from_millis(250),
            None,
            move |events_result: DebounceEventResult| {
                let id_clone = id.clone();
                let manager_clone = manager_clone.clone();

                // the debouncer runs on a separate vanilla thread
                run_async_command(async move {
                    if let Some(manager) = manager_clone.lock().await.as_mut() {
                        match events_result {
                            Ok(events) => {
                                manager.handle_file_events(&id_clone, events).await;
                            }
                            Err(errors) => {
                                manager.handle_file_errors(&id_clone, errors).await;
                            }
                        }
                    }
                });
            },
        )
        .map_err(|e| e.to_string())?;

        let fs_ops = FsOpsHandle::new();
        let state = WorkspaceState::new(id_clone.clone(), path.clone())
            .await
            .map_err(|e| WorkspaceError::WorkspaceReadError(path.clone(), e.to_string()));

        on_event(state.clone().into());

        debouncer
            .watch(&path, RecursiveMode::Recursive)
            .map_err(|e| e.to_string())?;

        let ws = Workspace {
            state,
            path,
            _debouncer: debouncer,
            fs_ops,
            on_event,
        };

        self.workspaces.insert(id_clone, ws);

        Ok(())
    }

    pub async fn unwatch_workspace(&mut self, id: String) -> Result<(), String> {
        // Drop will clean up debouncer and fs_ops
        self.workspaces.remove(&id);
        Ok(())
    }

    pub async fn create_workspace(
        &mut self,
        path: PathBuf,
        id: String,
        name: String,
    ) -> Result<(), String> {
        FsOps::create_workspace(path, id, name)
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn rename_workspace(&self, id: String, name: String) -> Result<(), String> {
        let workspace = self
            .workspaces
            .get(&id)
            .ok_or(format!("Workspace with id {} not found", id))?;
        let path = workspace.path.clone();
        workspace
            .fs_ops
            .rename_workspace(path, name)
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn save_runbook(&mut self, id: String, name: String, content: Value) {
        todo!()
    }

    pub async fn get_dir_info(&mut self, workspace_id: String) -> Result<WorkspaceDirInfo, String> {
        let workspace = self
            .workspaces
            .get_mut(&workspace_id)
            .ok_or(format!("Workspace with id {} not found", workspace_id))?;
        workspace
            .fs_ops
            .get_dir_info(workspace.path.clone())
            .await
            .map_err(|e| e.to_string())
    }

    async fn rescan_workspace(&mut self, workspace_id: &str) {
        let workspace = self.workspaces.get_mut(workspace_id).unwrap();
        match workspace.state.as_mut().unwrap().rescan().await {
            Ok(_) => {}
            Err(e) => {
                workspace.state = Err(WorkspaceError::WorkspaceReadError(
                    workspace.path.clone(),
                    e.to_string(),
                ));
            }
        }
    }

    async fn handle_file_events(&mut self, workspace_id: &str, events: Vec<DebouncedEvent>) {
        if !self.workspaces.contains_key(workspace_id) {
            return;
        }

        let mut full_rescan = false;

        for event in events {
            // returns true if notify detects some events may have been missed
            if event.need_rescan() {
                full_rescan = true;
                break;
            }

            let has_relevant_paths = event.paths.iter().any(|path| is_relevant_file(path));

            if !has_relevant_paths {
                continue;
            }

            match event.event.kind {
                EventKind::Access(_) => {}
                _ => {
                    // TODO: this could probably be smarter/more granular in the future,
                    // but there are enough edge cases that for now we just do a full rescan
                    full_rescan = true;
                    break;
                }
            }
        }

        if full_rescan {
            // If an error occurs during the rescan, the `state` field will be set to an error
            self.rescan_workspace(workspace_id).await;
        }

        let workspace = self.workspaces.get(workspace_id).unwrap();
        (workspace.on_event)(workspace.state.clone().into());
    }

    async fn handle_file_errors(
        &mut self,
        id: &str,
        errors: Vec<notify_debouncer_full::notify::Error>,
    ) {
        if !self.workspaces.contains_key(id) {
            return;
        }

        todo!()
    }

    pub async fn shutdown(&mut self) {
        self.reset();
    }
}

fn is_relevant_file(path: &PathBuf) -> bool {
    path.is_dir()
        || path
            .file_name()
            .map(|f| f.to_string_lossy().eq_ignore_ascii_case("atuin.toml"))
            .unwrap_or(false)
        || path
            .extension()
            .map(|f| f.to_string_lossy().eq_ignore_ascii_case(".atrb"))
            .unwrap_or(false)
}
