use std::path::PathBuf;

use atuin_client::settings::Settings;
use serde::{Deserialize, Serialize};

use crate::db::HistoryDB;

#[derive(Debug, Serialize, Deserialize)]
pub struct CommandStats {
    pub count: u64,
    pub top_commands: Vec<(String, u64)>,
    pub exit_code_distribution: Vec<(i64, u64)>,
}

#[tauri::command]
pub async fn command_stats(
    command: Option<String>,
    path: Option<String>,
    hostname: Option<String>,
    start: Option<i64>,
    end: Option<i64>,
) -> Result<CommandStats, String> {
    let settings = Settings::new().map_err(|e| e.to_string())?;
    let db_path = PathBuf::from(settings.db_path.as_str());
    let db = HistoryDB::new(db_path, settings.local_timeout).await?;

    let history = db
        .filter(
            command,
            path,
            hostname,
            start.map(|s| s * 1000000),
            end.map(|e| e * 1000000),
        )
        .await?;

    // Calculate the distribution of exit codes
    let mut exit_code_counts: std::collections::HashMap<i64, u64> =
        std::collections::HashMap::new();
    for entry in &history {
        *exit_code_counts.entry(entry.exit).or_insert(0) += 1;
    }

    // Convert to a vector of (exit_code, count) tuples
    let exit_code_distribution: Vec<(i64, u64)> = exit_code_counts.into_iter().collect();

    let top_commands = crate::stats::calc::top_commands(&settings, &history, 10, 1).unwrap();
    let stats = CommandStats {
        count: history.len() as u64,
        top_commands,
        exit_code_distribution,
    };
    Ok(stats)
}
