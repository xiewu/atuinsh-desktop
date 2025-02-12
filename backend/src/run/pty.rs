use std::{collections::HashMap, sync::Arc};
use uuid::Uuid;

use eyre::Result;
use minijinja::Environment;

use crate::{
    pty::{Pty, PtyMetadata},
    state::AtuinState,
};
use tauri::{
    async_runtime::{block_on, RwLock},
    Emitter, Manager, State,
};

const PTY_OPEN_CHANNEL: &str = "pty_open";
const PTY_KILL_CHANNEL: &str = "pty_kill";

async fn update_badge_count(
    app: &tauri::AppHandle,
    sessions: Arc<RwLock<HashMap<Uuid, Pty>>>,
) -> Result<()> {
    let len = sessions.read().await.len();
    let len = if len == 0 { None } else { Some(len as i64) };

    app.webview_windows()
        .values()
        .next()
        .expect("no window found")
        .set_badge_count(len)?;

    Ok(())
}

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

    let pty_sessions = state.pty_sessions.clone();
    tauri::async_runtime::spawn_blocking(move || loop {
        let mut buf = [0u8; 512];

        match reader.lock().unwrap().read(&mut buf) {
            // EOF
            Ok(0) => {
                println!("reader loop hit eof");
                block_on(remove_pty(app_inner.clone(), id, pty_sessions))
                    .expect("failed to remove pty");
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
    update_badge_count(&app, state.pty_sessions.clone())
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

pub(crate) async fn remove_pty(
    app: tauri::AppHandle,
    pid: uuid::Uuid,
    pty_sessions: Arc<RwLock<HashMap<Uuid, Pty>>>,
) -> Result<(), String> {
    let pty = pty_sessions.write().await.remove(&pid);

    if let Some(pty) = pty {
        pty.kill_child().await.map_err(|e| e.to_string())?;
        println!("RIP {pid:?}");

        app.emit(PTY_KILL_CHANNEL, pty.metadata)
            .map_err(|e| e.to_string())?;
    }

    update_badge_count(&app, pty_sessions.clone())
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
    remove_pty(app, pid, state.pty_sessions.clone()).await
}

#[tauri::command]
pub(crate) async fn pty_list(
    state: tauri::State<'_, AtuinState>,
) -> Result<Vec<PtyMetadata>, String> {
    let ptys = state.pty_sessions.read().await;
    let ptys = ptys.values().map(|p| p.metadata.clone()).collect();

    Ok(ptys)
}
