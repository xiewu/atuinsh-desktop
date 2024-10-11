use std::{collections::HashMap, sync::Arc};

use eyre::Result;
use minijinja::{context, Environment};

use crate::{pty::PtyMetadata, state::AtuinState, templates::TemplateState};
use tauri::{Emitter, State};

const PTY_OPEN_CHANNEL: &str = "pty_open";
const PTY_KILL_CHANNEL: &str = "pty_kill";

#[tauri::command]
pub async fn pty_open(
    app: tauri::AppHandle,
    state: State<'_, AtuinState>,
    cwd: Option<String>,
    env: Option<HashMap<String, String>>,
    runbook: String,
    block: String,
) -> Result<uuid::Uuid, String> {
    let id = uuid::Uuid::new_v4();

    let metadata = PtyMetadata {
        pid: id,
        runbook: runbook.clone(),
        block,
    };
    let cwd = cwd.map(|c| shellexpand::tilde(c.as_str()).to_string());

    let pty = crate::pty::Pty::open(24, 80, cwd, env.unwrap_or_default(), metadata.clone())
        .await
        .unwrap();

    let reader = pty.reader.clone();

    let app_inner = app.clone();
    tauri::async_runtime::spawn_blocking(move || loop {
        let mut buf = [0u8; 512];

        match reader.lock().unwrap().read(&mut buf) {
            // EOF
            Ok(0) => {
                println!("reader loop hit eof");
                break;
            }

            Ok(n) => {
                println!("read {n} bytes");

                // TODO: sort inevitable encoding issues
                let out = String::from_utf8_lossy(&buf).to_string();
                let out = out.trim_matches(char::from(0));
                let channel = format!("pty-{id}");

                app_inner.emit(channel.as_str(), out).unwrap();
            }

            Err(e) => {
                println!("failed to read: {e}");
                break;
            }
        }
    });

    let env = Environment::new();
    state
        .template_state
        .write()
        .await
        .insert(runbook, Arc::new(env));

    state.pty_sessions.write().await.insert(id, pty);

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
    let sessions = state.pty_sessions.read().await;
    let pty = sessions.get(&pid).ok_or("Pty not found")?;

    let bytes = data.as_bytes().to_vec();
    pty.send_bytes(bytes.into())
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
    let sessions = state.pty_sessions.read().await;
    let pty = sessions.get(&pid).ok_or("Pty not found")?;

    pty.resize(rows, cols).await.map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub(crate) async fn pty_kill(
    app: tauri::AppHandle,
    pid: uuid::Uuid,
    state: tauri::State<'_, AtuinState>,
) -> Result<(), String> {
    let pty = state.pty_sessions.write().await.remove(&pid);

    if let Some(pty) = pty {
        pty.kill_child().await.map_err(|e| e.to_string())?;
        println!("RIP {pid:?}");

        app.emit(PTY_KILL_CHANNEL, pty.metadata)
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub(crate) async fn pty_list(
    state: tauri::State<'_, AtuinState>,
) -> Result<Vec<PtyMetadata>, String> {
    let ptys = state.pty_sessions.read().await;
    let ptys = ptys.values().map(|p| p.metadata.clone()).collect();

    Ok(ptys)
}
