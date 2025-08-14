use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    sync::Arc,
    time::Duration,
};

use notify_debouncer_full::{
    new_debouncer,
    notify::{EventKind, RecursiveMode},
    DebounceEventResult, DebouncedEvent,
};
use serde::Serialize;
use serde_json::Value;
use ts_rs::TS;

use crate::{
    run_async_command,
    workspaces::{
        fs_ops::{FsOps, FsOpsHandle, WorkspaceDirInfo},
        state::WorkspaceState,
        workspace::{Workspace, WorkspaceError},
    },
};

pub trait OnEvent: Send + Sync + Fn(WorkspaceEvent) {}
impl<F: Send + Sync + Fn(WorkspaceEvent)> OnEvent for F {}

pub struct WorkspaceManager {
    workspaces: HashMap<String, Workspace>,
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
        path: impl AsRef<Path>,
        id: &str,
        on_event: impl OnEvent + 'static,
        // hack: we need to pass the manager to the callback, so we pass in
        // a clone of the manager Arc from the Tauri state
        manager_clone: Arc<tokio::sync::Mutex<Option<WorkspaceManager>>>,
    ) -> Result<(), WorkspaceError> {
        if self.workspaces.contains_key(id) {
            return Err(WorkspaceError::WorkspaceAlreadyWatched {
                workspace_id: id.to_string(),
            });
        }

        let on_event = Arc::new(on_event);

        let id_clone = id.to_string();
        let mut debouncer = new_debouncer(
            // 100ms is fast enough to make the UI feel responsive, but not too fast that
            // we fail to debounce or combine events
            Duration::from_millis(100),
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
        .map_err(|e| WorkspaceError::WatchError {
            workspace_id: id.to_string(),
            message: e.to_string(),
        })?;

        let fs_ops = FsOpsHandle::new();
        let state =
            WorkspaceState::new(id, &path)
                .await
                .map_err(|e| WorkspaceError::WorkspaceReadError {
                    path: path.as_ref().to_path_buf(),
                    message: e.to_string(),
                });

        on_event(state.clone().into());

        debouncer
            .watch(&path, RecursiveMode::Recursive)
            .map_err(|e| WorkspaceError::WatchError {
                workspace_id: id.to_string(),
                message: e.to_string(),
            })?;

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
        FsOps::create_workspace(path, id, name).await.map_err(|e| {
            WorkspaceError::WorkspaceCreateError {
                workspace_id: id.to_string(),
                message: e.to_string(),
            }
        })
    }

    pub async fn rename_workspace(&mut self, id: &str, name: &str) -> Result<(), WorkspaceError> {
        let workspace = self.get_workspace(id)?;
        workspace.rename(name).await
    }

    pub async fn create_runbook(
        &mut self,
        workspace_id: &str,
        parent_folder_id: Option<&str>,
    ) -> Result<String, WorkspaceError> {
        let workspace = self.get_workspace(workspace_id)?;
        workspace.create_runbook(parent_folder_id).await
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

    pub async fn create_folder(
        &mut self,
        workspace_id: &str,
        parent_path: Option<&str>,
        name: &str,
    ) -> Result<PathBuf, WorkspaceError> {
        let workspace = self.get_workspace(workspace_id)?;
        workspace
            .create_folder(parent_path.map(Path::new), name)
            .await
    }

    pub async fn rename_folder(
        &mut self,
        workspace_id: &str,
        folder_id: &str,
        new_name: &str,
    ) -> Result<(), WorkspaceError> {
        let workspace = self.get_workspace(workspace_id)?;
        workspace.rename_folder(folder_id, new_name).await
    }

    pub async fn delete_folder(
        &mut self,
        workspace_id: &str,
        folder_id: &str,
    ) -> Result<(), WorkspaceError> {
        let workspace = self.get_workspace(workspace_id)?;
        workspace.delete_folder(folder_id).await
    }

    pub async fn move_items(
        &mut self,
        workspace_id: &str,
        item_ids: &[String],
        new_parent: Option<&str>,
    ) -> Result<(), WorkspaceError> {
        let workspace = self.get_workspace(workspace_id)?;
        workspace.move_items(item_ids, new_parent).await
    }

    pub async fn get_dir_info(
        &mut self,
        workspace_id: &str,
    ) -> Result<WorkspaceDirInfo, WorkspaceError> {
        let workspace = self.get_workspace(workspace_id)?;
        workspace.get_dir_info().await
    }

    async fn rescan_workspace(&self, workspace_id: &str) -> Result<WorkspaceState, WorkspaceError> {
        if let Some(workspace) = self.workspaces.get(workspace_id) {
            workspace.rescan().await
        } else {
            Err(WorkspaceError::WorkspaceNotWatched {
                workspace_id: workspace_id.to_string(),
            })
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

            let has_relevant_paths = event.paths.iter().any(is_relevant_file);

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

        eprintln!("handle_file_errors: {errors:?}");
        todo!()
    }

    pub async fn shutdown(&mut self) {
        self.reset();
    }

    fn get_workspace(&mut self, id: &str) -> Result<&mut Workspace, WorkspaceError> {
        self.workspaces
            .get_mut(id)
            .ok_or(WorkspaceError::WorkspaceNotWatched {
                workspace_id: id.to_string(),
            })
    }
}

fn is_relevant_file(path: impl AsRef<Path>) -> bool {
    let path = path.as_ref();
    path.is_dir()
        || !path.exists() // If the file doesn't exist, we may have deleted it
        || path
            .file_name()
            .map(|f| f.to_string_lossy().eq_ignore_ascii_case("atuin.toml"))
            .unwrap_or(false)
        || path
            .extension()
            .map(|f| f.to_string_lossy().eq_ignore_ascii_case("atrb"))
            .unwrap_or(false)
}
