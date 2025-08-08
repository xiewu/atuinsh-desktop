use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    sync::Arc,
    time::Duration,
};

use json_digest::digest_data;
use notify_debouncer_full::{
    new_debouncer,
    notify::{EventKind, RecommendedWatcher, RecursiveMode},
    DebounceEventResult, DebouncedEvent, Debouncer, RecommendedCache,
};
use serde::Serialize;
use serde_json::{json, Value};
use ts_rs::TS;

use crate::{
    run_async_command,
    workspaces::{
        fs_ops::{FsOps, FsOpsHandle, WorkspaceDirInfo},
        hash_history::HashHistory,
        state::WorkspaceState,
    },
};

#[derive(thiserror::Error, TS, Debug, Clone, Serialize)]
#[serde(tag = "type", content = "data")]
#[ts(export, tag = "type", content = "data")]
pub enum WorkspaceError {
    #[error("Failed to process workspace")]
    WorkspaceReadError(PathBuf, String),
    #[error("Failed to create workspace")]
    WorkspaceCreateError(String, String),
    #[error("Workspace not watched")]
    WorkspaceNotWatched(String),
    #[error("Workspace already watched")]
    WorkspaceAlreadyWatched(String),
    #[error("Failed to save runbook")]
    RunbookSaveError(String, String),
    #[error("Failed to rename workspace")]
    WorkspaceRenameError(String, String),
    #[error("Failed to watch workspace")]
    WatchError(String, String),
}

pub trait OnEvent: Send + Sync + Fn(WorkspaceEvent) {}
impl<F: Send + Sync + Fn(WorkspaceEvent)> OnEvent for F {}

pub struct WorkspaceManager {
    workspaces: HashMap<String, Workspace>,
}

pub struct Workspace {
    id: String,
    state: Result<WorkspaceState, WorkspaceError>,
    histories: HashMap<String, HashHistory>,
    path: PathBuf,
    _debouncer: Debouncer<RecommendedWatcher, RecommendedCache>,
    fs_ops: FsOpsHandle,
    on_event: Arc<dyn OnEvent>,
}

impl Workspace {
    pub async fn rename(&mut self, name: &str) -> Result<(), WorkspaceError> {
        let path = self.path.clone();
        self.fs_ops
            .rename_workspace(path, name)
            .await
            .map_err(|e| WorkspaceError::WorkspaceRenameError(self.id.clone(), e.to_string()))
    }

    pub async fn save_runbook(
        &mut self,
        id: &str,
        name: &str,
        path: impl AsRef<Path>,
        content: &Value,
    ) -> Result<(), WorkspaceError> {
        if let Err(e) = &self.state {
            return Err(WorkspaceError::RunbookSaveError(
                id.to_string(),
                format!("Bad workspace state: {:?}", e),
            ));
        }

        let full_content = json!({
            "id": id,
            "name": name,
            "version": 1,
            "content": content,
        });

        match digest_data(&full_content) {
            Ok(digest) => {
                if let Some(history) = self.histories.get(id) {
                    if history.latest() == Some(&digest) {
                        return Ok(());
                    }
                }

                self.fs_ops
                    .save_runbook(&path, full_content)
                    .await
                    .map_err(|e| WorkspaceError::RunbookSaveError(id.to_string(), e.to_string()))?;

                self.histories
                    .entry(id.to_string())
                    .or_insert_with(|| HashHistory::new(5))
                    .push(digest);

                Ok(())
            }
            Err(e) => Err(WorkspaceError::RunbookSaveError(
                id.to_string(),
                e.to_string(),
            )),
        }
    }

    pub async fn get_dir_info(&self) -> Result<WorkspaceDirInfo, WorkspaceError> {
        self.fs_ops
            .get_dir_info(self.path.clone())
            .await
            .map_err(|e| WorkspaceError::WorkspaceReadError(self.path.clone(), e.to_string()))
    }

    async fn rescan(&self) -> Result<WorkspaceState, WorkspaceError> {
        WorkspaceState::new(&self.id, &self.path)
            .await
            .map_err(|e| WorkspaceError::WorkspaceReadError(self.path.clone(), e.to_string()))
    }
}

#[derive(TS, Debug, Serialize)]
#[serde(tag = "type", content = "data")]
#[ts(tag = "type", content = "data", export)]
pub enum WorkspaceEvent {
    State(WorkspaceState),
    Error(WorkspaceError),
    // RunbookContent(String, Value),
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
        path: impl AsRef<Path>,
        id: &str,
        on_event: impl OnEvent + 'static,
        // hack: we need to pass the manager to the callback, so we pass in
        // a clone of the manager Arc from the Tauri state
        manager_clone: Arc<tokio::sync::Mutex<Option<WorkspaceManager>>>,
    ) -> Result<(), WorkspaceError> {
        if self.workspaces.contains_key(id) {
            return Err(WorkspaceError::WorkspaceAlreadyWatched(id.to_string()));
        }

        let on_event = Arc::new(on_event);

        let id_clone = id.to_string();
        let mut debouncer = new_debouncer(
            Duration::from_millis(250),
            None,
            move |events_result: DebounceEventResult| {
                let manager_clone = manager_clone.clone();
                let id_clone = id_clone.clone();

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
        .map_err(|e| WorkspaceError::WatchError(id.to_string(), e.to_string()))?;

        let fs_ops = FsOpsHandle::new();
        let state = WorkspaceState::new(&id, &path).await.map_err(|e| {
            WorkspaceError::WorkspaceReadError(path.as_ref().to_path_buf(), e.to_string())
        });

        on_event(state.clone().into());

        debouncer
            .watch(&path, RecursiveMode::Recursive)
            .map_err(|e| WorkspaceError::WatchError(id.to_string(), e.to_string()))?;

        let ws = Workspace {
            id: id.to_string(),
            state,
            histories: HashMap::new(),
            path: path.as_ref().to_path_buf(),
            _debouncer: debouncer,
            fs_ops,
            on_event,
        };

        self.workspaces.insert(id.to_string(), ws);

        Ok(())
    }

    pub async fn unwatch_workspace(&mut self, id: &str) -> Result<(), WorkspaceError> {
        // Drop will clean up debouncer and fs_ops
        self.workspaces.remove(id);
        Ok(())
    }

    pub async fn create_workspace(
        &mut self,
        path: impl AsRef<Path>,
        id: &str,
        name: &str,
    ) -> Result<(), WorkspaceError> {
        FsOps::create_workspace(path, id, name)
            .await
            .map_err(|e| WorkspaceError::WorkspaceCreateError(id.to_string(), e.to_string()))
    }

    pub async fn rename_workspace(&mut self, id: &str, name: &str) -> Result<(), WorkspaceError> {
        let workspace = self.get_workspace(id)?;
        workspace.rename(name).await
    }

    pub async fn save_runbook(
        &mut self,
        workspace_id: &str,
        id: &str,
        name: &str,
        path: impl AsRef<Path>,
        content: Value,
    ) -> Result<(), WorkspaceError> {
        let workspace = self.get_workspace(workspace_id)?;
        workspace.save_runbook(id, name, path, &content).await
    }

    pub async fn get_dir_info(
        &mut self,
        workspace_id: &str,
    ) -> Result<WorkspaceDirInfo, WorkspaceError> {
        let workspace = self.get_workspace(&workspace_id)?;
        workspace.get_dir_info().await
    }

    async fn rescan_workspace(&self, workspace_id: &str) -> Result<WorkspaceState, WorkspaceError> {
        if let Some(workspace) = self.workspaces.get(workspace_id) {
            workspace.rescan().await
        } else {
            Err(WorkspaceError::WorkspaceNotWatched(
                workspace_id.to_string(),
            ))
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
            match self.rescan_workspace(workspace_id).await {
                Ok(updated) => {
                    if let Some(workspace) = self.workspaces.get_mut(workspace_id) {
                        // TODO

                        workspace.state = Ok(updated);
                        (workspace.on_event)(workspace.state.clone().into());
                    }
                }
                Err(e) => {
                    if let Some(workspace) = self.workspaces.get_mut(workspace_id) {
                        workspace.state = Err(e);

                        (workspace.on_event)(workspace.state.clone().into());
                    }
                }
            }
        }
    }

    async fn handle_file_errors(
        &mut self,
        id: &str,
        errors: Vec<notify_debouncer_full::notify::Error>,
    ) {
        if !self.workspaces.contains_key(id) {
            return;
        }

        eprintln!("handle_file_errors: {:?}", errors);
        todo!()
    }

    pub async fn shutdown(&mut self) {
        self.reset();
    }

    fn get_workspace(&mut self, id: &str) -> Result<&mut Workspace, WorkspaceError> {
        self.workspaces
            .get_mut(id)
            .ok_or(WorkspaceError::WorkspaceNotWatched(id.to_string()))
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
