use std::collections::HashMap;
use std::{process::Stdio, sync::Arc};

use atuin_common::utils::uuid_v7;
use tauri::{Emitter, State};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::RwLock;

use crate::state::AtuinState;

/// Execute a shell command and stream the output over a channel
/// Unlike a pty, this is not interactive
#[tauri::command]
pub async fn shell_exec(
    app: tauri::AppHandle,
    interpreter: String,
    channel: String,
    command: String,
    state: State<'_, AtuinState>,
    runbook: Option<String>,
    output_variable: Option<String>,
) -> Result<(), String> {
    // Split interpreter string into command and args
    let parts: Vec<&str> = interpreter.split_whitespace().collect();
    let (cmd_name, cmd_args) = parts.split_first().unwrap();

    let cmd = Command::new(cmd_name)
        .args(cmd_args)
        .arg(command)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .unwrap();

    let cmd = Arc::new(RwLock::new(cmd));

    let id = uuid_v7();
    state.child_processes.write().await.insert(id, cmd.clone());

    // Spawn a channel for handling multithreaded writes to the output
    let (output_tx, mut output_rx) = tokio::sync::mpsc::channel::<String>(100);

    let output_vars = state.runbook_output_variables.clone();

    // Spawn a task to listen to the output channel and write to the buffer
    let _output_handle = tokio::spawn(async move {
        // Create a string buffer to store the output
        let mut output = String::new();

        while let Some(line) = output_rx.recv().await {
            output.push_str(&line);
        }

        // the above loop stops when the channel is closed
        // so we can set the output variable in the state
        if let Some(runbook) = runbook {
            if let Some(output_variable) = output_variable {
                output_vars
                    .write()
                    .await
                    .entry(runbook)
                    .or_insert(HashMap::new())
                    .insert(output_variable, output);
                println!("output_vars: {:?}", output_vars.read().await);
            }
        }
    });

    // Spawn stdout reader
    let stdout = cmd.write().await.stdout.take().unwrap();
    let app_clone = app.clone();
    let channel_clone = channel.clone();

    let out_output_tx = output_tx.clone();
    let out_handle = tokio::spawn(async move {
        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();
        while let Some(line) = lines.next_line().await.unwrap() {
            out_output_tx.send(line.clone()).await.unwrap();
            app_clone.emit(channel_clone.as_str(), line).unwrap();
        }
    });

    // Spawn stderr reader
    let stderr = cmd.write().await.stderr.take().unwrap();
    let app_clone = app.clone();
    let channel_clone = channel.clone();

    let err_output_tx = output_tx.clone();
    let err_handle = tokio::spawn(async move {
        let reader = BufReader::new(stderr);
        let mut lines = reader.lines();
        while let Some(line) = lines.next_line().await.unwrap() {
            err_output_tx.send(line.clone()).await.unwrap();
            app_clone.emit(channel_clone.as_str(), line).unwrap();
        }
    });

    // Wait for the command to complete
    cmd.write().await.wait().await.unwrap();
    out_handle.abort();
    err_handle.abort();
    drop(output_tx);

    state.child_processes.write().await.remove(&id);

    Ok(())
}
