use std::{collections::HashMap, path::PathBuf, time::Duration};

use notify_debouncer_full::{
    new_debouncer,
    notify::{RecommendedWatcher, RecursiveMode},
    DebounceEventResult, DebouncedEvent, Debouncer, RecommendedCache,
};

use crate::workspaces::fs_ops::{FsOps, FsOpsHandle, WorkspaceDirInfo};

pub trait OnEvent: Send + Sync + Sized + Fn(DebouncedEvent) {}
impl<F: Send + Sync + Sized + Fn(DebouncedEvent)> OnEvent for F {}

pub struct WorkspaceManager {
    workspaces: HashMap<String, Workspace>,
}

pub struct Workspace {
    id: String,
    path: PathBuf,
    debouncer: Debouncer<RecommendedWatcher, RecommendedCache>,
    fs_ops: FsOpsHandle,
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

        let mut debouncer = new_debouncer(
            Duration::from_millis(250),
            None,
            move |event: DebounceEventResult| {
                if let Ok(events) = event {
                    for event in events {
                        on_event(event);
                    }
                }
            },
        )
        .expect("Failed to create debouncer");

        debouncer
            .watch(&path, RecursiveMode::Recursive)
            .map_err(|e| e.to_string())?;

        let fs_ops = FsOpsHandle::new();

        let ws = Workspace {
            id: id.clone(),
            path,
            debouncer,
            fs_ops,
        };

        self.workspaces.insert(id, ws);

        Ok(())
    }

    pub async fn unwatch_workspace(&mut self, id: String) -> Result<(), String> {
        if let Some(mut workspace) = self.workspaces.remove(&id) {
            workspace
                .debouncer
                .unwatch(&workspace.path)
                .map_err(|e| e.to_string())?;
        }
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
        let path = workspace.path.clone();
        workspace
            .fs_ops
            .rename_workspace(path, name)
            .await
            .map_err(|e| e.to_string())
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

    pub async fn shutdown(&mut self) {
        self.reset();
    }
}
