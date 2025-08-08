use std::path::PathBuf;

use notify_debouncer_full::notify::Event;
use tauri::{ipc::Channel, AppHandle, Manager, State};

use crate::{
    state::AtuinState,
    workspaces::{
        fs_ops::WorkspaceDirInfo,
        manager::{WorkspaceError, WorkspaceEvent},
    },
};

#[tauri::command]
pub async fn reset_workspaces(state: State<'_, AtuinState>) -> Result<(), WorkspaceError> {
    let mut manager = state.workspaces.lock().await;
    let manager = manager.as_mut().expect("Workspaces not found in state");
    manager.reset();
    Ok(())
}

#[tauri::command]
pub async fn watch_workspace(
    path: PathBuf,
    id: String,
    channel: Channel<WorkspaceEvent>,
    state: State<'_, AtuinState>,
) -> Result<(), WorkspaceError> {
    let workspaces_clone = state.workspaces.clone();
    let mut manager = state.workspaces.lock().await;
    let manager = manager.as_mut().expect("Workspaces not found in state");
    manager
        .watch_workspace(
            path,
            &id,
            move |event: WorkspaceEvent| match channel.send(event) {
                Ok(_) => (),
                Err(e) => {
                    println!("Error sending workspace event: {:?}", e);
                }
            },
            workspaces_clone,
        )
        .await
}

#[tauri::command]
pub async fn unwatch_workspace(
    id: String,
    state: State<'_, AtuinState>,
) -> Result<(), WorkspaceError> {
    let mut manager = state.workspaces.lock().await;
    let manager = manager.as_mut().expect("Workspaces not found in state");
    manager.unwatch_workspace(&id).await
}

#[tauri::command]
pub async fn create_workspace(
    path: PathBuf,
    id: String,
    name: String,
    state: State<'_, AtuinState>,
) -> Result<(), WorkspaceError> {
    let mut manager = state.workspaces.lock().await;
    let manager = manager.as_mut().expect("Workspaces not found in state");
    manager.create_workspace(&path, &id, &name).await
}

#[tauri::command]
pub async fn rename_workspace(
    id: String,
    name: String,
    state: State<'_, AtuinState>,
) -> Result<(), WorkspaceError> {
    let mut manager = state.workspaces.lock().await;
    let manager = manager.as_mut().expect("Workspaces not found in state");
    manager.rename_workspace(&id, &name).await
}

#[tauri::command]
pub async fn delete_workspace(id: String) -> Result<(), WorkspaceError> {
    Ok(())
}

#[tauri::command]
pub async fn read_dir(
    workspace_id: String,
    state: State<'_, AtuinState>,
) -> Result<WorkspaceDirInfo, WorkspaceError> {
    let mut manager = state.workspaces.lock().await;
    let manager = manager.as_mut().expect("Workspace not found in state");
    manager.get_dir_info(&workspace_id).await
}
