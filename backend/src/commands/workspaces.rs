use std::path::PathBuf;

use serde_json::Value;
use tauri::{ipc::Channel, State};

use crate::{
    state::AtuinState,
    workspaces::{fs_ops::WorkspaceDirInfo, manager::WorkspaceEvent, workspace::WorkspaceError},
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
pub async fn delete_workspace(_id: String) -> Result<(), WorkspaceError> {
    todo!()
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

#[tauri::command]
pub async fn save_runbook(
    workspace_id: String,
    id: String,
    name: String,
    path: PathBuf,
    content: Value,
    state: State<'_, AtuinState>,
) -> Result<(), WorkspaceError> {
    let mut manager = state.workspaces.lock().await;
    let manager = manager.as_mut().expect("Workspace not found in state");
    manager
        .save_runbook(&workspace_id, &id, &name, &path, content)
        .await
}

#[tauri::command]
pub async fn create_folder(
    workspace_id: String,
    parent_path: Option<String>,
    name: String,
    state: State<'_, AtuinState>,
) -> Result<String, WorkspaceError> {
    let mut manager = state.workspaces.lock().await;
    let manager = manager.as_mut().expect("Workspace not found in state");
    manager
        .create_folder(&workspace_id, parent_path.as_deref(), &name)
        .await
        .map(|path| path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn rename_folder(
    workspace_id: String,
    folder_id: String,
    new_name: String,
    state: State<'_, AtuinState>,
) -> Result<(), WorkspaceError> {
    let mut manager = state.workspaces.lock().await;
    let manager = manager.as_mut().expect("Workspace not found in state");
    manager
        .rename_folder(&workspace_id, &folder_id, &new_name)
        .await
}

#[tauri::command]
pub async fn move_items(
    workspace_id: String,
    item_ids: Vec<String>,
    new_parent: Option<String>,
    state: State<'_, AtuinState>,
) -> Result<(), WorkspaceError> {
    let mut manager = state.workspaces.lock().await;
    let manager = manager.as_mut().expect("Workspace not found in state");
    manager
        .move_items(&workspace_id, &item_ids, new_parent.as_deref())
        .await
}
