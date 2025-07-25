use std::path::PathBuf;

use atuin_common::utils::uuid_v7;
use serde::{Deserialize, Serialize};
use tokio::sync::{
    mpsc::{channel, error::SendError, Receiver, Sender},
    oneshot,
};
use toml::{Table, Value};

#[derive(thiserror::Error, Debug)]
pub enum FsOpsError {
    #[error("Failed to send instruction to filesystem operations actor: {0}")]
    SendError(#[from] SendError<FsOpsInstruction>),
    #[error("IO Operation failed: {0}")]
    IoError(#[from] std::io::Error),
    #[error("Failed to serialize workspace config: {0}")]
    SerializeError(#[from] toml::ser::Error),
    #[error("Failed to deserialize workspace config: {0}")]
    DeserializeError(#[from] toml::de::Error),
}

pub type Reply<T> = oneshot::Sender<Result<T, FsOpsError>>;

pub enum FsOpsInstruction {
    RenameWorkspace(PathBuf, String, Reply<()>),
    GetDirectoryInformation(PathBuf, Reply<WorkspaceDirInfo>),
    Shutdown,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WorkspaceDirInfo {
    pub id: String,
    pub name: String,
    pub path: PathBuf,
    pub contents: Vec<DirEntry>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DirEntry {
    pub name: String,
    pub is_dir: bool,
    pub path: PathBuf,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WorkspaceConfig {
    pub workspace: WorkspaceConfigDetails,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WorkspaceConfigDetails {
    pub id: String,
    pub name: String,
    pub index: Option<Table>,
}

impl WorkspaceConfig {
    pub fn new(id: String, name: String) -> Self {
        Self {
            workspace: WorkspaceConfigDetails {
                id,
                name,
                index: None,
            },
        }
    }
}

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

    pub async fn get_dir_info(&self, path: PathBuf) -> Result<WorkspaceDirInfo, FsOpsError> {
        let (sender, receiver) = oneshot::channel();
        self.tx
            .send(FsOpsInstruction::GetDirectoryInformation(path, sender))
            .await?;
        receiver.await.unwrap()
    }

    pub async fn rename_workspace(&self, path: PathBuf, name: String) -> Result<(), FsOpsError> {
        let (sender, receiver) = oneshot::channel();
        self.tx
            .send(FsOpsInstruction::RenameWorkspace(path, name, sender))
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

pub struct FsOps {
    //
}

impl FsOps {
    pub fn new() -> Self {
        Self {}
    }

    pub async fn create_workspace(
        path: PathBuf,
        id: String,
        name: String,
    ) -> Result<(), FsOpsError> {
        let mut config = WorkspaceConfig::new(id, name);
        let mut table = Table::new();
        // TODO[mkt]: This is a placeholder for the index. We need to actually build the index here.
        table.insert(
            uuid_v7().to_string(),
            Value::String("path/to-file1.atrb".to_string()),
        );
        table.insert(
            uuid_v7().to_string(),
            Value::String("path/to-file2.atrb".to_string()),
        );
        config.workspace.index = Some(table);

        let workspace_path = path.join("atuin.toml");
        let contents = toml::to_string(&config)?;
        tokio::fs::write(workspace_path, contents).await?;
        Ok(())
    }

    pub async fn run(&mut self, mut rx: Receiver<FsOpsInstruction>) {
        loop {
            let instruction = rx.recv().await.unwrap();
            match instruction {
                FsOpsInstruction::GetDirectoryInformation(path, reply_to) => {
                    let info = self.get_directory_information(path).await;
                    let _ = reply_to.send(info);
                }
                FsOpsInstruction::RenameWorkspace(path, name, reply_to) => {
                    let _ = self.rename_workspace(path, name).await;
                    let _ = reply_to.send(Ok(()));
                }
                FsOpsInstruction::Shutdown => {
                    break;
                }
            }
        }
    }

    async fn get_directory_information(
        &mut self,
        path: PathBuf,
    ) -> Result<WorkspaceDirInfo, FsOpsError> {
        let mut contents = read_dir_recursive(&path)?;
        contents.retain(|entry| entry.name.ends_with(".atrb"));
        let config_text = tokio::fs::read_to_string(path.join("atuin.toml")).await?;
        let config: WorkspaceConfig = toml::from_str(&config_text)?;
        Ok(WorkspaceDirInfo {
            id: config.workspace.id,
            name: config.workspace.name,
            path,
            contents,
        })
    }

    async fn rename_workspace(&mut self, path: PathBuf, name: String) -> Result<(), FsOpsError> {
        let config_text = tokio::fs::read_to_string(path.join("atuin.toml")).await?;
        let mut config: WorkspaceConfig = toml::from_str(&config_text)?;
        config.workspace.name = name;
        let contents = toml::to_string(&config)?;
        tokio::fs::write(path.join("atuin.toml"), contents).await?;
        Ok(())
    }
}

fn read_dir_recursive(path: &PathBuf) -> Result<Vec<DirEntry>, FsOpsError> {
    let mut contents = Vec::new();
    for entry in std::fs::read_dir(path)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            contents.push(DirEntry {
                name: path.file_name().unwrap().to_string_lossy().to_string(),
                is_dir: true,
                path: path.clone(),
            });
            contents.extend(read_dir_recursive(&path)?);
        } else {
            contents.push(DirEntry {
                name: path.file_name().unwrap().to_string_lossy().to_string(),
                is_dir: false,
                path,
            });
        }
    }
    Ok(contents)
}
