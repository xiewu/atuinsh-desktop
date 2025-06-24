use std::{collections::HashMap, sync::Arc};
use uuid::Uuid;

use eyre::Result;
use minijinja::Environment;

use crate::{pty::PtyMetadata, runtime::pty_store::PtyStoreHandle, state::AtuinState};
use tauri::{ipc::Channel, Emitter, Manager, State};

pub const PTY_OPEN_CHANNEL: &str = "pty_open";
pub const PTY_KILL_CHANNEL: &str = "pty_kill";

async fn update_badge_count(app: &tauri::AppHandle, store: PtyStoreHandle) -> Result<()> {
    let len = store.len().await?;
    let len = if len == 0 { None } else { Some(len as i64) };

    app.webview_windows()
        .values()
        .next()
        .expect("no window found")
        .set_badge_count(len)?;

    Ok(())
}

#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub async fn pty_open(
    app: tauri::AppHandle,
    state: State<'_, AtuinState>,
    cwd: Option<String>,
    env: Option<HashMap<String, String>>,
    runbook: Uuid,
    block: String,
    shell: Option<String>,
    output_channel: Channel<Vec<u8>>,
) -> Result<uuid::Uuid, String> {
    let id = uuid::Uuid::new_v4();

    let nanoseconds_now = time::OffsetDateTime::now_utc().unix_timestamp_nanos();
    let metadata = PtyMetadata {
        pid: id,
        runbook,
        block,
        created_at: nanoseconds_now as u64,
    };
    let cwd = cwd.map(|c| shellexpand::tilde(c.as_str()).to_string());

    let pty = match crate::pty::Pty::open(
        24,
        80,
        cwd,
        env.unwrap_or_default(),
        metadata.clone(),
        shell,
    )
    .await
    {
        Ok(pty) => pty,
        Err(e) => {
            return Err(format!("Failed to open terminal: {}", e));
        }
    };

    let reader = pty.reader.clone();
    let app_inner = app.clone();
    let pty_store = state.pty_store();

    tokio::task::spawn(async move {
        loop {
            let read_result = tokio::task::spawn_blocking({
                let reader = reader.clone();
                move || -> Result<(usize, [u8; 4096]), String> {
                    let mut buf = [0u8; 4096];
                    let mut reader = reader.lock().map_err(|e| format!("Lock failed: {e}"))?;
                    let bytes_read = reader
                        .read(&mut buf)
                        .map_err(|e| format!("Read failed: {e}"))?;
                    Ok((bytes_read, buf))
                }
            })
            .await;

            match read_result {
                Ok(Ok((0, _))) => {
                    // EOF
                    println!("PTY reader loop hit EOF for {}", id);
                    if let Err(e) = remove_pty(app_inner.clone(), id, pty_store).await {
                        println!("failed to remove pty: {e}");
                    }
                    break;
                }
                Ok(Ok((n, buf))) => {
                    let bytes = buf[..n].to_vec();

                    let channel_clone = output_channel.clone();
                    let send_result =
                        tokio::task::spawn_blocking(move || channel_clone.send(bytes)).await;

                    if let Ok(Err(e)) = send_result {
                        println!("PTY channel send failed: {e}, closing reader");
                        break;
                    }
                }
                Ok(Err(e)) => {
                    println!("PTY read error: {e:?}");
                    break;
                }
                Err(e) => {
                    println!("PTY spawn_blocking error: {e:?}");
                    break;
                }
            }
        }
    });

    let env = Environment::new();
    state
        .template_state
        .write()
        .await
        .insert(runbook, Arc::new(env));

    state
        .pty_store()
        .add_pty(Box::new(pty))
        .await
        .map_err(|e| e.to_string())?;
    update_badge_count(&app, state.pty_store())
        .await
        .map_err(|e| e.to_string())?;

    app.emit(PTY_OPEN_CHANNEL, metadata)
        .map_err(|e| e.to_string())?;

    Ok(id)
}

#[tauri::command]
pub(crate) async fn pty_write(
    pid: uuid::Uuid,
    data: String,
    state: tauri::State<'_, AtuinState>,
) -> Result<(), String> {
    let bytes = data.as_bytes().to_vec();
    state
        .pty_store()
        .write_pty(pid, bytes.into())
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub(crate) async fn pty_resize(
    pid: uuid::Uuid,
    rows: u16,
    cols: u16,
    state: tauri::State<'_, AtuinState>,
) -> Result<(), String> {
    state
        .pty_store()
        .resize_pty(pid, rows, cols)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

pub(crate) async fn remove_pty(
    app: tauri::AppHandle,
    pid: uuid::Uuid,
    store: PtyStoreHandle,
) -> Result<(), String> {
    let pty_meta = store.get_pty_meta(pid).await.map_err(|e| e.to_string())?;
    store.remove_pty(pid).await.map_err(|e| e.to_string())?;

    if let Some(pty_meta) = pty_meta {
        app.emit(PTY_KILL_CHANNEL, pty_meta)
            .map_err(|e| e.to_string())?;
    }

    update_badge_count(&app, store.clone())
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub(crate) async fn pty_kill(
    app: tauri::AppHandle,
    pid: uuid::Uuid,
    state: tauri::State<'_, AtuinState>,
) -> Result<(), String> {
    remove_pty(app, pid, state.pty_store()).await
}

#[tauri::command]
pub(crate) async fn pty_list(
    state: tauri::State<'_, AtuinState>,
) -> Result<Vec<PtyMetadata>, String> {
    let ptys = state
        .pty_store()
        .list_pty_meta()
        .await
        .map_err(|e| e.to_string())?;

    Ok(ptys)
}
