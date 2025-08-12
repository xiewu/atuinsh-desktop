use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    sync::Arc,
};

use json_digest::digest_data;
use notify_debouncer_full::{notify::RecommendedWatcher, Debouncer, RecommendedCache};
use serde::Serialize;
use serde_json::{json, Value};
use ts_rs::TS;

use crate::workspaces::{
    fs_ops::{FsOpsHandle, WorkspaceDirInfo},
    hash_history::HashHistory,
    manager::OnEvent,
    state::WorkspaceState,
};

#[derive(thiserror::Error, TS, Debug, Clone, Serialize)]
#[serde(tag = "type", content = "data")]
#[ts(export, tag = "type", content = "data")]
pub enum WorkspaceError {
    #[error("Failed to process workspace at {path}: {message}")]
    WorkspaceReadError { path: PathBuf, message: String },
    #[error("Failed to create workspace {workspace_id}: {message}")]
    WorkspaceCreateError {
        workspace_id: String,
        message: String,
    },
    #[error("Workspace {workspace_id} not watched")]
    WorkspaceNotWatched { workspace_id: String },
    #[error("Workspace {workspace_id} already watched")]
    WorkspaceAlreadyWatched { workspace_id: String },
    #[error("Failed to save runbook {runbook_id}: {message}")]
    RunbookSaveError { runbook_id: String, message: String },
    #[error("Failed to rename workspace {workspace_id}: {message}")]
    WorkspaceRenameError {
        workspace_id: String,
        message: String,
    },
    #[error("Failed to watch workspace {workspace_id}: {message}")]
    WatchError {
        workspace_id: String,
        message: String,
    },
    #[error("Failed to create folder {name} in {workspace_id}: {message}")]
    FolderCreateError {
        workspace_id: String,
        name: String,
        message: String,
    },
    #[error("Failed to rename folder {folder_id}: {message}")]
    FolderRenameError {
        workspace_id: String,
        folder_id: String,
        message: String,
    },

    #[error("{message}")]
    GenericWorkspaceError { message: String },
}

pub struct Workspace {
    pub id: String,
    pub state: Result<WorkspaceState, WorkspaceError>,
    pub histories: HashMap<String, HashHistory>,
    pub path: PathBuf,
    pub _debouncer: Debouncer<RecommendedWatcher, RecommendedCache>,
    pub fs_ops: FsOpsHandle,
    pub on_event: Arc<dyn OnEvent>,
}

impl Workspace {
    pub async fn rename(&mut self, name: &str) -> Result<(), WorkspaceError> {
        let path = self.path.clone();
        self.fs_ops.rename_workspace(path, name).await.map_err(|e| {
            WorkspaceError::WorkspaceRenameError {
                workspace_id: self.id.clone(),
                message: e.to_string(),
            }
        })
    }

    pub async fn create_folder(
        &mut self,
        parent_path: Option<&Path>,
        name: &str,
    ) -> Result<PathBuf, WorkspaceError> {
        self.fs_ops
            .create_folder(&parent_path.unwrap_or(&self.path), &name)
            .await
            .map_err(|e| WorkspaceError::FolderCreateError {
                workspace_id: self.id.clone(),
                name: name.to_string(),
                message: e.to_string(),
            })
    }

    pub async fn rename_folder(
        &mut self,
        folder_id: &str,
        new_name: &str,
    ) -> Result<(), WorkspaceError> {
        let from = PathBuf::from(folder_id);
        if let Some(parent) = from.parent() {
            let to = parent.join(new_name);
            self.fs_ops.rename_folder(&from, &to).await.map_err(|e| {
                WorkspaceError::FolderRenameError {
                    workspace_id: self.id.clone(),
                    folder_id: folder_id.to_string(),
                    message: e.to_string(),
                }
            })
        } else {
            Err(WorkspaceError::FolderRenameError {
                workspace_id: self.id.clone(),
                folder_id: folder_id.to_string(),
                message: "Folder has no parent".to_string(),
            })
        }
    }

    pub async fn save_runbook(
        &mut self,
        id: &str,
        name: &str,
        path: impl AsRef<Path>,
        content: &Value,
    ) -> Result<(), WorkspaceError> {
        if let Err(e) = &self.state {
            return Err(WorkspaceError::RunbookSaveError {
                runbook_id: id.to_string(),
                message: format!("Bad workspace state: {:?}", e),
            });
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
                    .map_err(|e| WorkspaceError::RunbookSaveError {
                        runbook_id: id.to_string(),
                        message: e.to_string(),
                    })?;

                self.histories
                    .entry(id.to_string())
                    .or_insert_with(|| HashHistory::new(5))
                    .push(digest);

                Ok(())
            }
            Err(e) => Err(WorkspaceError::RunbookSaveError {
                runbook_id: id.to_string(),
                message: e.to_string(),
            }),
        }
    }

    pub async fn get_dir_info(&self) -> Result<WorkspaceDirInfo, WorkspaceError> {
        self.fs_ops
            .get_dir_info(self.path.clone())
            .await
            .map_err(|e| WorkspaceError::WorkspaceReadError {
                path: self.path.clone(),
                message: e.to_string(),
            })
    }

    pub async fn rescan(&self) -> Result<WorkspaceState, WorkspaceError> {
        WorkspaceState::new(&self.id, &self.path)
            .await
            .map_err(|e| WorkspaceError::WorkspaceReadError {
                path: self.path.clone(),
                message: e.to_string(),
            })
    }
}
