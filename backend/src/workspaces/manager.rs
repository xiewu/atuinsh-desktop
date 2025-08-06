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
        state::{WorkspaceState, WorkspaceStateError},
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
    debouncer: Debouncer<RecommendedWatcher, RecommendedCache>,
    fs_ops: FsOpsHandle,
    on_event: Arc<dyn OnEvent>,
}

#[derive(TS, Debug, Serialize)]
#[serde(tag = "type", content = "data")]
#[ts(tag = "type", content = "data", export)]
pub enum WorkspaceEvent {
    State(WorkspaceState),
    Error(WorkspaceError),
    OtherMessage(String),
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
            move |event: DebounceEventResult| {
                let id_clone = id.clone();
                let manager_clone = manager_clone.clone();

                // the debouncer runs on a separate vanilla thread
                run_async_command(async move {
                    let mut manager = manager_clone.lock().await;
                    let manager = manager.as_mut().unwrap();
                    match event {
                        Ok(events) => {
                            manager.handle_file_events(&id_clone, events).await;
                        }
                        Err(events) => {
                            manager.handle_file_errors(&id_clone, events).await;
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

        match &state {
            Ok(state) => {
                on_event(WorkspaceEvent::State(state.clone()));
            }
            Err(err) => {
                on_event(WorkspaceEvent::Error(err.clone()));
            }
        }

        debouncer
            .watch(&path, RecursiveMode::Recursive)
            .map_err(|e| e.to_string())?;

        let ws = Workspace {
            state,
            path,
            debouncer,
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

    async fn rescan_full_workspace(&mut self, workspace_id: &str) {
        let workspace_path = self
            .workspaces
            .get(workspace_id)
            .expect("Workspace not found")
            .path
            .clone();
        let new_state = WorkspaceState::new(workspace_id.to_string(), workspace_path.clone())
            .await
            .map_err(|e| WorkspaceError::WorkspaceReadError(workspace_path, e.to_string()));

        let on_event = &self.workspaces.get_mut(workspace_id).unwrap().on_event;
        match &new_state {
            Ok(state) => {
                on_event(WorkspaceEvent::State(state.clone()));
            }
            Err(err) => {
                on_event(WorkspaceEvent::Error(err.clone()));
            }
        }

        self.workspaces.get_mut(workspace_id).unwrap().state = new_state;
    }

    async fn rescan_runbook(&mut self, workspace_id: &str, runbook_path: &PathBuf) {
        todo!()
    }

    async fn rescan_config(&mut self, workspace_id: &str) {
        todo!()
    }

    async fn handle_file_events(&mut self, workspace_id: &str, events: Vec<DebouncedEvent>) {
        if !self.workspaces.contains_key(workspace_id) {
            return;
        }

        for event in events {
            println!("Event: {:?}", event);
            self.rescan_full_workspace(workspace_id).await;
            // match event.event.kind {
            //     EventKind::Create(_) => {
            //         let relevant_files = event
            //             .paths
            //             .iter()
            //             .map(|path| {
            //                 path.strip_prefix(&self.workspaces.get(workspace_id).unwrap().path)
            //                     .unwrap_or(path)
            //                     .to_path_buf()
            //             })
            //             .filter(|path| {
            //                 path.ends_with(".atrb")
            //                     || path.to_str() == Some("atuin.toml")
            //                     || path.is_dir()
            //             })
            //             .collect::<Vec<_>>();

            //         let runbook_files = relevant_files
            //             .iter()
            //             .filter(|path| path.ends_with(".atrb"))
            //             .collect::<Vec<_>>();

            //         let config_changed = relevant_files
            //             .iter()
            //             .any(|path| path.to_str() == Some("atuin.toml"));

            //         let has_new_dirs = relevant_files.iter().any(|path| path.is_dir());

            //         if has_new_dirs {
            //             self.rescan_full_workspace(workspace_id).await;
            //         } else {
            //             if config_changed {
            //                 self.rescan_config(workspace_id).await;
            //             }

            //             for path in runbook_files {
            //                 self.rescan_runbook(workspace_id, path).await;
            //             }
            //         }
            //     }
            //     _ => {}
            // }
        }
    }

    async fn handle_file_errors(
        &mut self,
        id: &str,
        events: Vec<notify_debouncer_full::notify::Error>,
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
