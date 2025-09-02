use std::time::SystemTime;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use ts_rs::TS;

#[derive(TS, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[ts(export, rename = "RustOfflineRunbook")]
pub struct OfflineRunbook {
    #[serde(flatten)]
    pub file: OfflineRunbookFile,
    pub workspace_id: String,
}

#[derive(TS, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[ts(export, rename = "RustOfflineRunbookFile")]
pub struct OfflineRunbookFile {
    pub id: String,
    pub name: String,
    #[ts(type = "any[]")]
    pub content: Value,
    #[ts(type = "{ secs_since_epoch: number, nanos_since_epoch: number } | null")]
    pub created: Option<SystemTime>,
    #[ts(type = "{ secs_since_epoch: number, nanos_since_epoch: number } | null")]
    pub updated: Option<SystemTime>,
}

impl OfflineRunbook {
    pub fn new(file: OfflineRunbookFile, workspace_id: String) -> Self {
        Self { file, workspace_id }
    }
}
