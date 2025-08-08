use std::{
    path::{Path, PathBuf},
    time::SystemTime,
};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::sync::{
    mpsc::{channel, error::SendError, Receiver, Sender},
    oneshot,
};
use ts_rs::TS;

#[derive(thiserror::Error, Debug)]
pub enum FsOpsError {
    #[error("Failed to send instruction to filesystem operations actor: {0}")]
    SendError(#[from] SendError<FsOpsInstruction>),
    #[error("File missing: {0}")]
    FileMissingError(String),
    #[error("IO Operation failed: {0}")]
    IoError(#[from] std::io::Error),
    #[error("Failed to serialize workspace config: {0}")]
    WorkspaceSerializeError(#[from] toml::ser::Error),
    #[error("Failed to serialize runbook: {0}")]
    RunbookSerializeError(#[from] serde_json::Error),
    #[error("Failed to deserialize workspace config: {0}")]
    DeserializeError(#[from] toml::de::Error),
}

pub type Reply<T> = oneshot::Sender<Result<T, FsOpsError>>;

pub enum FsOpsInstruction {
    RenameWorkspace(PathBuf, String, Reply<()>),
    GetDirectoryInformation(PathBuf, Reply<WorkspaceDirInfo>),
    SaveRunbook(PathBuf, Value, Reply<()>),
    Shutdown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceDirInfo {
    pub id: String,
    pub name: String,
    pub path: PathBuf,
    pub contents: Vec<DirEntry>,
}

#[derive(TS, Debug, Clone, Serialize, Deserialize, PartialEq)]
#[ts(export)]
pub struct DirEntry {
    pub name: String,
    pub is_dir: bool,
    pub path: PathBuf,
    #[ts(type = "{ secs_since_epoch: number, nanos_since_epoch: number } | null")]
    pub lastmod: Option<SystemTime>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WorkspaceConfig {
    // Nested so that there are no top-level keys in the config file
    pub workspace: WorkspaceConfigDetails,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WorkspaceConfigDetails {
    pub id: String,
    pub name: String,
}

impl WorkspaceConfig {
    pub fn new(id: String, name: String) -> Self {
        Self {
            workspace: WorkspaceConfigDetails { id, name },
        }
    }

    pub async fn from_file(path: impl AsRef<Path>) -> Result<Self, FsOpsError> {
        let config_text = tokio::fs::read_to_string(path).await?;
        let config: WorkspaceConfig = toml::from_str(&config_text)?;
        Ok(config)
    }
}

#[derive(Clone)]
pub struct FsOpsHandle {
    tx: Sender<FsOpsInstruction>,
}

impl FsOpsHandle {
    pub fn new() -> Self {
        let (tx, rx) = channel(16);

        tauri::async_runtime::spawn(async move {
            let mut actor = FsOps::new();
            actor.run(rx).await;
        });

        Self { tx }
    }

    pub async fn get_dir_info(
        &self,
        path: impl AsRef<Path>,
    ) -> Result<WorkspaceDirInfo, FsOpsError> {
        let (sender, receiver) = oneshot::channel();
        self.tx
            .send(FsOpsInstruction::GetDirectoryInformation(
                path.as_ref().to_path_buf(),
                sender,
            ))
            .await?;
        receiver.await.unwrap()
    }

    pub async fn rename_workspace(
        &self,
        path: impl AsRef<Path>,
        name: &str,
    ) -> Result<(), FsOpsError> {
        let (sender, receiver) = oneshot::channel();
        self.tx
            .send(FsOpsInstruction::RenameWorkspace(
                path.as_ref().to_path_buf(),
                name.to_string(),
                sender,
            ))
            .await?;
        receiver.await.unwrap()
    }

    pub async fn save_runbook(
        &self,
        path: impl AsRef<Path>,
        content: Value,
    ) -> Result<(), FsOpsError> {
        let (sender, receiver) = oneshot::channel();

        self.tx
            .send(FsOpsInstruction::SaveRunbook(
                path.as_ref().to_path_buf(),
                content,
                sender,
            ))
            .await?;
        receiver.await.unwrap()
    }

    pub async fn shutdown(&self) -> Result<(), FsOpsError> {
        self.tx.send(FsOpsInstruction::Shutdown).await?;
        Ok(())
    }
}

impl Drop for FsOpsHandle {
    fn drop(&mut self) {
        let _ = self.shutdown();
    }
}

pub struct FsOps {}

impl FsOps {
    pub fn new() -> Self {
        Self {}
    }

    pub async fn create_workspace(
        path: impl AsRef<Path>,
        id: &str,
        name: &str,
    ) -> Result<(), FsOpsError> {
        let config = WorkspaceConfig::new(id.to_string(), name.to_string());
        let workspace_path = path.as_ref().join("atuin.toml");
        let contents = toml::to_string(&config)?;
        tokio::fs::write(workspace_path, contents).await?;

        Ok(())
    }

    pub async fn run(&mut self, mut rx: Receiver<FsOpsInstruction>) {
        while let Some(instruction) = rx.recv().await {
            match instruction {
                FsOpsInstruction::GetDirectoryInformation(path, reply_to) => {
                    let info = self.get_directory_information(&path).await;
                    let _ = reply_to.send(info);
                }
                FsOpsInstruction::RenameWorkspace(path, name, reply_to) => {
                    let result = self.rename_workspace(&path, &name).await;
                    let _ = reply_to.send(result);
                }
                FsOpsInstruction::SaveRunbook(path, content, reply_to) => {
                    let result = self.save_runbook(&path, content).await;
                    let _ = reply_to.send(result);
                }
                FsOpsInstruction::Shutdown => {
                    break;
                }
            }
        }
    }

    async fn get_directory_information(
        &mut self,
        path: impl AsRef<Path>,
    ) -> Result<WorkspaceDirInfo, FsOpsError> {
        let config_path = path.as_ref().join("atuin.toml");
        if !config_path.exists() {
            return Err(FsOpsError::FileMissingError("atuin.toml".to_string()));
        }

        let mut contents = read_dir_recursive(path.as_ref()).await?;
        contents.retain(|entry| entry.name.ends_with(".atrb"));
        let config_text = tokio::fs::read_to_string(config_path).await?;
        let config: WorkspaceConfig = toml::from_str(&config_text)?;
        Ok(WorkspaceDirInfo {
            id: config.workspace.id,
            name: config.workspace.name,
            path: path.as_ref().to_path_buf(),
            contents,
        })
    }

    async fn rename_workspace(
        &mut self,
        path: impl AsRef<Path>,
        name: &str,
    ) -> Result<(), FsOpsError> {
        let config_path = path.as_ref().join("atuin.toml");
        if !config_path.exists() {
            return Err(FsOpsError::FileMissingError("atuin.toml".to_string()));
        }

        let config_text = tokio::fs::read_to_string(config_path).await?;
        let mut config: WorkspaceConfig = toml::from_str(&config_text)?;
        config.workspace.name = name.to_string();
        let contents = toml::to_string(&config)?;
        tokio::fs::write(path.as_ref().join("atuin.toml"), contents).await?;
        Ok(())
    }

    async fn save_runbook(
        &mut self,
        path: impl AsRef<Path>,
        content: Value,
    ) -> Result<(), FsOpsError> {
        let json_text = serde_json::to_string_pretty(&content)?;
        tokio::fs::write(path.as_ref(), json_text).await?;
        Ok(())
    }
}

// Using an iterative approach here as recursing fails due to recursive Box::pin issues
pub async fn read_dir_recursive(path: impl AsRef<Path>) -> Result<Vec<DirEntry>, FsOpsError> {
    let mut contents = Vec::new();
    let mut stack = vec![path.as_ref().to_path_buf()];

    while let Some(current_path) = stack.pop() {
        let mut dir = tokio::fs::read_dir(&current_path).await?;
        while let Some(entry) = dir.next_entry().await? {
            let mut path = entry.path();
            if path.is_symlink() {
                path = path.read_link()?;
            }
            let attrs = entry.metadata().await?;
            let lastmod = attrs.modified().ok();

            if path.is_dir() {
                contents.push(DirEntry {
                    name: path.file_name().unwrap().to_string_lossy().to_string(),
                    is_dir: true,
                    path: path.clone(),
                    lastmod,
                });
                stack.push(path);
            } else if path.is_file() {
                contents.push(DirEntry {
                    name: path.file_name().unwrap().to_string_lossy().to_string(),
                    is_dir: false,
                    path,
                    lastmod,
                });
            }
        }
    }

    Ok(contents)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_read_dir_recursive() -> Result<(), Box<dyn std::error::Error>> {
        let temp = tempdir()?;
        let base = temp.path();

        // Create nested directory structure
        let dir1 = base.join("dir1");
        let dir2 = dir1.join("dir2");
        let dir3 = dir1.join("dir3");
        fs::create_dir_all(&dir2)?;
        fs::create_dir_all(&dir3)?;

        // Create some files
        fs::write(dir1.join("file1.txt"), "content1")?;
        fs::write(dir2.join("file2.txt"), "content2")?;
        fs::write(dir3.join("file3.txt"), "content3")?;
        fs::write(base.join("root.txt"), "root")?;

        let entries = read_dir_recursive(base).await?;

        // Verify we found all directories and files
        assert_eq!(entries.len(), 7); // 3 dirs + 4 files

        // Check for directories
        let dirs: Vec<_> = entries.iter().filter(|e| e.is_dir).collect();
        assert_eq!(dirs.len(), 3);
        assert!(dirs.iter().any(|d| d.path == dir1));
        assert!(dirs.iter().any(|d| d.path == dir2));
        assert!(dirs.iter().any(|d| d.path == dir3));

        // Check for files
        let files: Vec<_> = entries.iter().filter(|e| !e.is_dir).collect();
        assert_eq!(files.len(), 4);
        assert!(files.iter().any(|f| f.path == base.join("root.txt")));
        assert!(files.iter().any(|f| f.path == dir1.join("file1.txt")));
        assert!(files.iter().any(|f| f.path == dir2.join("file2.txt")));
        assert!(files.iter().any(|f| f.path == dir3.join("file3.txt")));

        Ok(())
    }
}
