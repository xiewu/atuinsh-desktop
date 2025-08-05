use std::{collections::HashMap, path::PathBuf, time::SystemTime};

use actson::{tokio::AsyncBufReaderJsonFeeder, JsonEvent, JsonParser};
use serde::Serialize;
use serde_json::{Number, Value};
use tokio::{fs::File, io::BufReader};
use ts_rs::TS;

use crate::workspaces::{
    fs_ops::{DirEntry, WorkspaceConfig},
    hash_history::HashHistory,
};

#[derive(thiserror::Error, Debug)]
pub enum WorkspaceError {
    #[error("Failed to read directory: {0}")]
    DirReadError(PathBuf),
    #[error("Expected file or directory: {0}")]
    BadFileType(PathBuf),
    #[error("Failed to read directory: {0}")]
    IoError(#[from] std::io::Error),
    #[error("Failed to parse workspace config: {0}")]
    TomlError(#[from] toml::de::Error),
    // #[error("Failed to parse workspace index: {0}")]
    // IndexError(#[from] crate::workspaces::index::WorkspaceIndexError),
    #[error("Failed to read workspace info: {0}")]
    WorkspaceReadError(#[from] crate::workspaces::fs_ops::FsOpsError),
    #[error("Invalid workspace manifest: expected ID {0}, found ID {1}")]
    InvalidWorkspaceManifest(String, String),
    #[error("Invalid ATRB file: {0}")]
    InvalidAtrbFile(PathBuf),
    #[error("Failed to parse JSON: {0}")]
    JsonError(#[from] actson::parser::ParserError),
    #[error("Failed to parse number: {0}")]
    ParseFloatError(#[from] actson::parser::InvalidFloatValueError),
    #[error("Failed to parse number: {0}")]
    ParseIntError(#[from] actson::parser::InvalidIntValueError),
    #[error("Failed to parse string: {0}")]
    ParseStringError(#[from] actson::parser::InvalidStringValueError),
    #[error("Failed to read from file: {0}")]
    FillError(#[from] actson::feeder::FillError),
}

#[derive(TS, Debug, Clone, Serialize)]
#[ts(export)]
pub struct WorkspaceState {
    pub id: String,
    pub name: String,
    pub root: PathBuf,
    pub entries: Vec<DirEntry>,
    #[ts(type = "Record<string, WorkspaceRunbook>")]
    pub runbooks: HashMap<String, WorkspaceRunbook>,
}

impl WorkspaceState {
    pub async fn new(id: String, root: PathBuf) -> Result<Self, WorkspaceError> {
        let config = WorkspaceConfig::from_file(root.join("atuin.toml")).await?;
        println!("Config: {:?}", config);
        if config.workspace.id != id {
            return Err(WorkspaceError::InvalidWorkspaceManifest(
                id,
                config.workspace.id,
            ));
        }

        let entries = read_dir_recursive(&root).await?;
        let runbooks = get_workspace_runbooks(&root, &entries).await?;

        Ok(Self {
            id,
            name: config.workspace.name,
            root,
            entries,
            runbooks,
        })
    }
}

#[derive(TS, Debug, Clone, Serialize)]
#[ts(export)]
pub struct WorkspaceRunbook {
    id: String,
    name: String,
    #[ts(type = "number")]
    version: u64,
    path: PathBuf,
    history: HashHistory,
    #[ts(type = "{ secs_since_epoch: number, nanos_since_epoch: number } | null")]
    lastmod: Option<SystemTime>,
}

impl WorkspaceRunbook {
    pub fn new(
        id: String,
        name: String,
        version: u64,
        path: PathBuf,
        lastmod: Option<SystemTime>,
    ) -> Self {
        Self {
            id,
            name,
            version,
            path,
            history: HashHistory::new(5),
            lastmod,
        }
    }

    /// Incrementally parses an .atrb file to find the ID and name of the runbook.
    /// Once these are found, the function returns and the rest of the file is ignored.
    pub async fn from_file(path: PathBuf) -> Result<Self, WorkspaceError> {
        let file = File::open(&path).await?;
        let stats = File::metadata(&file).await?;
        drop(file);

        let info = get_json_keys(&path, &["id", "name", "version"]).await?;
        let id = info
            .get("id")
            .and_then(|v| v.as_str())
            .map(|v| v.to_string())
            .ok_or_else(|| WorkspaceError::InvalidAtrbFile(path.clone()))?;
        let name = info
            .get("name")
            .and_then(|v| v.as_str())
            .map(|v| v.to_string())
            .ok_or_else(|| WorkspaceError::InvalidAtrbFile(path.clone()))?;
        let version = info
            .get("version")
            .and_then(|v| v.as_u64())
            .ok_or_else(|| WorkspaceError::InvalidAtrbFile(path.clone()))?;

        Ok(Self::new(id, name, version, path, stats.modified().ok()))
    }
}

enum ParseState {
    None,
    Expecting(String),
}

async fn get_workspace_runbooks(
    root: &PathBuf,
    dir_entries: &[DirEntry],
) -> Result<HashMap<String, WorkspaceRunbook>, WorkspaceError> {
    let mut runbooks = HashMap::new();
    for entry in dir_entries {
        let name = entry
            .path
            .file_name()
            .ok_or_else(|| WorkspaceError::DirReadError(entry.path.clone()))?
            .to_string_lossy()
            .to_string();

        if name.ends_with(".atrb") {
            let runbook = WorkspaceRunbook::from_file(entry.path.clone()).await?;
            runbooks.insert(runbook.id.clone(), runbook);
        }
    }
    Ok(runbooks)
}

pub async fn read_dir_recursive(path: &PathBuf) -> Result<Vec<DirEntry>, WorkspaceError> {
    let mut contents = Vec::new();
    let mut dir = tokio::fs::read_dir(path).await?;
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
            contents.extend(Box::pin(read_dir_recursive(&path)).await?);
        } else if path.is_file() {
            contents.push(DirEntry {
                name: path.file_name().unwrap().to_string_lossy().to_string(),
                is_dir: false,
                path,
                lastmod,
            });
        }
    }
    Ok(contents)
}

/// Incrementally parses a JSON file to find the values of the given keys.
/// The keys must be present in the JSON file, and must exist at the top level of the JSON object.
/// The value of the key must be a primitive type: string, number, boolean, or null.
/// The function returns a map of the keys to their values.
async fn get_json_keys(
    atrb_path: &PathBuf,
    keys: &[&str],
) -> Result<HashMap<String, Value>, WorkspaceError> {
    let file = File::open(&atrb_path).await?;
    let reader = BufReader::with_capacity(1024, file);
    let feeder = AsyncBufReaderJsonFeeder::new(reader);

    let mut result = HashMap::with_capacity(keys.len());

    let mut parser = JsonParser::new(feeder);
    let mut state = ParseState::None;
    let mut obj_level = 0;

    while let Some(event) = parser.next_event()? {
        match event {
            JsonEvent::NeedMoreInput => {
                parser.feeder.fill_buf().await?;
            }
            JsonEvent::StartObject => {
                obj_level += 1;
                state = ParseState::None;
            }
            JsonEvent::EndObject => {
                obj_level -= 1;
                state = ParseState::None;
            }
            JsonEvent::FieldName => {
                if obj_level != 1 {
                    state = ParseState::None;
                    continue;
                }

                let field_name = parser.current_str()?;

                if keys.contains(&field_name) {
                    state = ParseState::Expecting(field_name.to_string());
                } else {
                    state = ParseState::None;
                }
            }
            JsonEvent::ValueString => {
                if obj_level != 1 {
                    state = ParseState::None;
                    continue;
                }

                if let ParseState::Expecting(field_name) = state {
                    let value = parser.current_str()?.to_string();
                    let value = Value::String(value);
                    result.insert(field_name, value);
                    state = ParseState::None;
                }
            }
            JsonEvent::ValueFloat => {
                if obj_level != 1 {
                    state = ParseState::None;
                    continue;
                }

                if let ParseState::Expecting(field_name) = state {
                    let value = parser.current_float()?;
                    let value = Number::from_f64(value)
                        .ok_or(WorkspaceError::InvalidAtrbFile(atrb_path.clone()))?;
                    let value = Value::Number(value);
                    result.insert(field_name, value);
                    state = ParseState::None;
                }
            }
            JsonEvent::ValueInt => {
                if obj_level != 1 {
                    state = ParseState::None;
                    continue;
                }

                if let ParseState::Expecting(field_name) = state {
                    let value: i64 = parser.current_int()?;
                    let value = Value::Number(value.into());
                    result.insert(field_name, value);
                    state = ParseState::None;
                }
            }
            JsonEvent::ValueNull => {
                if obj_level != 1 {
                    state = ParseState::None;
                    continue;
                }

                if let ParseState::Expecting(field_name) = state {
                    let value = Value::Null;
                    result.insert(field_name, value);
                    state = ParseState::None;
                }
            }
            JsonEvent::ValueTrue => {
                if obj_level != 1 {
                    state = ParseState::None;
                    continue;
                }

                if let ParseState::Expecting(field_name) = state {
                    let value = Value::Bool(true);
                    result.insert(field_name, value);
                    state = ParseState::None;
                }
            }
            JsonEvent::ValueFalse => {
                if obj_level != 1 {
                    state = ParseState::None;
                    continue;
                }

                if let ParseState::Expecting(field_name) = state {
                    let value = Value::Bool(false);
                    result.insert(field_name, value);
                    state = ParseState::None;
                }
            }
            _ => {
                state = ParseState::None;
            }
        }

        if result.len() == keys.len() {
            break;
        }
    }

    if result.len() != keys.len() {
        return Err(WorkspaceError::InvalidAtrbFile(atrb_path.clone()));
    }

    Ok(result)
}

#[cfg(test)]
mod tests {
    use serde_json::json;
    use tempfile::TempDir;

    use crate::workspaces::fs_ops::WorkspaceConfigDetails;

    use super::*;

    async fn setup() -> TempDir {
        let root = tempfile::tempdir().unwrap();
        tokio::fs::create_dir_all(&root).await.unwrap();

        let config = toml::to_string(&WorkspaceConfig {
            workspace: WorkspaceConfigDetails {
                id: "test".to_string(),
                name: "Test Workspace".to_string(),
            },
        })
        .unwrap();

        let config_path = root.path().join("atuin.toml");
        tokio::fs::write(&config_path, config).await.unwrap();

        let rb1 = json!({
            "id": "rb1",
            "name": "Runbook 1",
            "version": 1,
        });

        let rb1_path = root.path().join("rb1.atrb");
        tokio::fs::write(&rb1_path, rb1.to_string()).await.unwrap();

        let rb2 = json!({
            "id": "rb2",
            "name": "Runbook 2",
            "version": 2,
        });

        let rb2_path = root.path().join("rb2.atrb");
        tokio::fs::write(&rb2_path, rb2.to_string()).await.unwrap();

        root
    }

    #[tokio::test]
    async fn test_workspace_state() {
        let root = setup().await;
        let state = WorkspaceState::new("test".to_string(), root.path().to_path_buf())
            .await
            .unwrap();

        assert_eq!(state.id, "test");
        assert_eq!(&state.root, &root.path());

        assert_eq!(state.runbooks.len(), 2);

        let rb1 = state.runbooks.get("rb1").unwrap();
        assert_eq!(rb1.id, "rb1");
        assert_eq!(rb1.name, "Runbook 1");
        assert_eq!(rb1.version, 1);

        let rb2 = state.runbooks.get("rb2").unwrap();
        assert_eq!(rb2.id, "rb2");
        assert_eq!(rb2.name, "Runbook 2");
        assert_eq!(rb2.version, 2);
    }
}
