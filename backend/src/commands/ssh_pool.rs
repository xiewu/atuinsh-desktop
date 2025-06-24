use crate::pty::PtyMetadata;
use crate::run::pty::PTY_OPEN_CHANNEL;
use crate::runtime::ssh::session::Authentication;
use crate::runtime::ssh_pool::SshPty;
use crate::state::AtuinState;

use eyre::Result;
use std::path::PathBuf;
use tauri::{ipc::Channel, Emitter};
use uuid::Uuid;

/// Connect to an SSH host
#[tauri::command]
pub async fn ssh_connect(
    state: tauri::State<'_, AtuinState>,
    host: String,
    username: Option<String>,
    password: Option<String>,
    key_path: Option<String>,
) -> Result<(), String> {
    let ssh_pool = state.ssh_pool();

    let host = if !host.contains(":") {
        format!("{}:22", host)
    } else {
        host
    };

    // Determine authentication method
    let auth = match (password, key_path) {
        (Some(pass), _) => Some(Authentication::Password(
            username.clone().unwrap_or_default(),
            pass,
        )),
        (_, Some(path)) => Some(Authentication::Key(
            username.clone().unwrap_or_default(),
            PathBuf::from(path),
        )),
        _ => None,
    };

    ssh_pool
        .connect(&host, username.as_deref(), auth)
        .await
        .map_err(|e| {
            log::error!("Failed to connect to SSH host: {}", e);
            e.to_string()
        })?;

    Ok(())
}

/// Disconnect from an SSH host
#[tauri::command]
pub async fn ssh_disconnect(
    state: tauri::State<'_, AtuinState>,
    host: String,
    username: String,
) -> Result<(), String> {
    let ssh_pool = state.ssh_pool();

    ssh_pool
        .disconnect(&host, &username)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// List all active SSH connections
#[tauri::command]
pub async fn ssh_list_connections(
    state: tauri::State<'_, AtuinState>,
) -> Result<Vec<String>, String> {
    let ssh_pool = state.ssh_pool();

    ssh_pool.list_connections().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ssh_exec(
    state: tauri::State<'_, AtuinState>,
    app: tauri::AppHandle,
    host: String,
    username: &str,
    channel: &str,
    command: &str,
    interpreter: &str,
) -> Result<String, String> {
    let host = if !host.contains(":") {
        format!("{}:22", host)
    } else {
        host
    };

    let ssh_pool = state.ssh_pool();
    let (sender, mut receiver) = tokio::sync::mpsc::channel(100);
    let (result_tx, result_rx) = tokio::sync::oneshot::channel();

    // TODO(ellie): refactor the local script executor to work in the same way as the ssh remote does
    // this will allow us to use similar code for both local and remote execution, and have more reliable
    // local execution

    ssh_pool
        .exec(
            &host,
            username,
            interpreter,
            command,
            channel,
            sender,
            result_tx,
        )
        .await
        .map_err(|e| e.to_string())?;

    while let Some(line) = receiver.recv().await {
        app.emit(channel, line).unwrap();
    }

    // Wait for the result_rx to be sent, indicating the command has finished
    // emit this to the frontend
    // TODO: use it to communicate the exit code of the command
    let channel = channel.to_string();
    tokio::task::spawn(async move {
        let _ = result_rx.await;
        let channel = format!("ssh_exec_finished:{}", channel);
        log::debug!("Sending ssh_exec_finished event to {}", channel);
        app.emit(channel.as_str(), "").unwrap();
    });

    Ok(String::new())
}

#[tauri::command]
pub async fn ssh_exec_cancel(
    state: tauri::State<'_, AtuinState>,
    channel: &str,
) -> Result<(), String> {
    let ssh_pool = state.ssh_pool();
    ssh_pool
        .exec_cancel(channel)
        .await
        .map_err(|e| e.to_string())
}

/// Open an interactive SSH PTY session
#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub async fn ssh_open_pty(
    state: tauri::State<'_, AtuinState>,
    app: tauri::AppHandle,
    host: &str,
    username: &str,
    channel: &str,
    runbook: &str,
    block: &str,
    width: u16,
    height: u16,
    output_channel: Channel<Vec<u8>>,
) -> Result<(), String> {
    let host = if !host.contains(":") {
        format!("{}:22", host)
    } else {
        host.to_string()
    };

    let ssh_pool = state.ssh_pool();

    // Create channels for bidirectional communication
    let (output_sender, mut output_receiver) = tokio::sync::mpsc::channel(100);

    // Start the PTY session
    let pty_tx = ssh_pool
        .open_pty(
            host.as_str(),
            username,
            channel,
            output_sender,
            width,
            height,
        )
        .await
        .map_err(|e| e.to_string())?;

    // Forward output from the PTY to the frontend via channel
    tokio::task::spawn(async move {
        while let Some(output) = output_receiver.recv().await {
            let bytes = output.into_bytes();
            let channel_clone = output_channel.clone();
            let send_result = tokio::task::spawn_blocking(move || channel_clone.send(bytes)).await;

            if let Ok(Err(e)) = send_result {
                log::error!("Failed to send SSH PTY output to channel: {}", e);
                break;
            }
        }
    });

    // to fit into the same plumbing as a local pty, we also need to emit PTY_OPEN_CHANNEL
    let nanoseconds_now = time::OffsetDateTime::now_utc().unix_timestamp_nanos();
    let meta = PtyMetadata {
        pid: Uuid::parse_str(channel).unwrap(),
        runbook: Uuid::parse_str(runbook).unwrap(),
        block: block.to_string(),
        created_at: nanoseconds_now as u64,
    };
    let ssh_pty = SshPty {
        tx: pty_tx.0,
        resize_tx: pty_tx.1,
        metadata: meta.clone(),
        ssh_pool: ssh_pool.clone(),
    };
    state
        .pty_store()
        .add_pty(Box::new(ssh_pty))
        .await
        .map_err(|e| e.to_string())?;

    app.emit(PTY_OPEN_CHANNEL, meta)
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Send input to an open SSH PTY session
#[tauri::command]
pub async fn ssh_write_pty(
    state: tauri::State<'_, AtuinState>,
    channel: &str,
    input: &str,
) -> Result<(), String> {
    let ssh_pool = state.ssh_pool();
    let bytes = input.as_bytes().to_vec();
    ssh_pool
        .pty_write(channel, bytes.into())
        .await
        .map_err(|e| e.to_string())
}
