use std::{collections::HashMap, path::PathBuf, sync::Arc, time::Duration};

use notify_debouncer_full::{
    new_debouncer,
    notify::{RecommendedWatcher, RecursiveMode},
    DebounceEventResult, DebouncedEvent, Debouncer, RecommendedCache,
};
use serde::Serialize;
use serde_json::Value;
use ts_rs::TS;

use crate::workspaces::{
    fs_ops::{FsOps, FsOpsHandle, WorkspaceDirInfo},
    state::WorkspaceState,
};

pub trait OnEvent: Send + Sync + Fn(WorkspaceEvent) {}
impl<F: Send + Sync + Fn(WorkspaceEvent)> OnEvent for F {}

pub struct WorkspaceManager {
    workspaces: HashMap<String, Workspace>,
}

pub struct Workspace {
    state: WorkspaceState,
    debouncer: Debouncer<RecommendedWatcher, RecommendedCache>,
    fs_ops: FsOpsHandle,
    on_event: Arc<dyn OnEvent>,
}

#[derive(TS, Debug, Serialize)]
#[ts(export)]
pub enum WorkspaceEvent {
    InitialState(WorkspaceState),
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
    ) -> Result<(), String> {
        if self.workspaces.contains_key(&id) {
            return Err(format!("Workspace with id {} already watched", id));
        }

        let on_event = Arc::new(on_event);

        let on_event_clone = on_event.clone();
        let mut debouncer = new_debouncer(
            Duration::from_millis(250),
            None,
            move |event: DebounceEventResult| {
                if let Ok(events) = event {
                    for event in events {
                        on_event_clone(WorkspaceEvent::OtherMessage(format!("{:?}", event)));
                    }
                }
            },
        )
        .map_err(|e| e.to_string())?;

        let fs_ops = FsOpsHandle::new();
        let state = WorkspaceState::new(id.clone(), path.clone())
            .await
            .map_err(|e| e.to_string())?;

        on_event(WorkspaceEvent::InitialState(state.clone()));

        debouncer
            .watch(&path, RecursiveMode::Recursive)
            .map_err(|e| e.to_string())?;

        let ws = Workspace {
            state,
            debouncer,
            fs_ops,
            on_event,
        };

        self.workspaces.insert(id, ws);

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

    pub async fn rename_workspace(&mut self, id: String, name: String) -> Result<(), String> {
        let workspace = self
            .workspaces
            .get_mut(&id)
            .ok_or(format!("Workspace with id {} not found", id))?;
        let path = workspace.state.root.clone();
        workspace
            .fs_ops
            .rename_workspace(path, name)
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn save_runbook(&mut self, id: String, name: String, content: Value) {
        //
    }

    pub async fn get_dir_info(&mut self, workspace_id: String) -> Result<WorkspaceDirInfo, String> {
        let workspace = self
            .workspaces
            .get_mut(&workspace_id)
            .ok_or(format!("Workspace with id {} not found", workspace_id))?;
        workspace
            .fs_ops
            .get_dir_info(workspace.state.root.clone())
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn shutdown(&mut self) {
        self.reset();
    }
}
