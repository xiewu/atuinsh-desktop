use std::{
    collections::{HashMap, HashSet},
    path::{Path, PathBuf},
    sync::Arc,
    time::Duration,
};

use ignore::{gitignore::GitignoreBuilder, WalkBuilder};

// Shared function to create a gitignore matcher with consistent ignore settings
pub fn create_ignore_matcher(
    root_path: &Path,
) -> Result<ignore::gitignore::Gitignore, ignore::Error> {
    let mut builder = GitignoreBuilder::new(root_path);

    // Add gitignore files from the workspace
    let gitignore_path = root_path.join(".gitignore");
    if gitignore_path.exists() {
        builder.add(&gitignore_path);
    }

    builder.build()
}

// Check if a path should be ignored based on our rules
pub fn should_ignore_path(
    path: &Path,
    workspace_root: &Path,
    gitignore: Option<&ignore::gitignore::Gitignore>,
) -> bool {
    let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

    // Always ignore common directories
    if matches!(
        name,
        "node_modules" | "target" | "dist" | "build" | "__pycache__" | "venv" | "env" | ".env"
    ) {
        return true;
    }

    // Always ignore hidden files/directories (except we might want some)
    if name.starts_with('.') && !matches!(name, ".atrb" | ".atuin") {
        return true;
    }

    // Check gitignore rules if we have them
    if let Some(gitignore) = gitignore {
        let relative_path = path.strip_prefix(workspace_root).unwrap_or(path);
        let matched = gitignore.matched(relative_path, path.is_dir());
        if matched.is_ignore() {
            return true;
        }
    }

    false
}

// Shared function to create WalkBuilder with consistent ignore settings (for file watching only)
pub fn create_ignore_walker<P: AsRef<Path>>(root_path: P) -> WalkBuilder {
    let root_path = root_path.as_ref();
    let mut builder = WalkBuilder::new(root_path);
    builder
        .hidden(true)
        .git_ignore(true)
        .git_global(true)
        .git_exclude(true)
        .parents(true)
        .ignore(true)
        .follow_links(false);
    builder
}
use notify_debouncer_full::{
    new_debouncer,
    notify::{event::ModifyKind, EventKind, RecursiveMode},
    DebounceEventResult, DebouncedEvent,
};
use serde::Serialize;
use serde_json::Value;

use ts_rs::TS;

use crate::{
    run_async_command,
    workspaces::{
        fs_ops::{FsOps, FsOpsHandle, WorkspaceDirInfo},
        offline_runbook::OfflineRunbook,
        state::WorkspaceState,
        workspace::{Workspace, WorkspaceError},
    },
};

pub trait OnEvent: Send + Sync + Fn(WorkspaceEvent) {}
impl<F: Send + Sync + Fn(WorkspaceEvent)> OnEvent for F {}

pub struct WorkspaceManager {
    workspaces: HashMap<String, Workspace>,
}

#[derive(TS, Debug, Serialize, Eq, Hash, PartialEq)]
#[serde(tag = "type", content = "data")]
#[ts(tag = "type", content = "data", export)]
pub enum WorkspaceEvent {
    State(WorkspaceState),
    Error(WorkspaceError),
    RunbookChanged(String),
    RunbookDeleted(String),
}

impl From<Result<WorkspaceState, WorkspaceError>> for WorkspaceEvent {
    fn from(state: Result<WorkspaceState, WorkspaceError>) -> Self {
        match state {
            Ok(state) => WorkspaceEvent::State(state),
            Err(err) => WorkspaceEvent::Error(err),
        }
    }
}

impl WorkspaceManager {
    pub fn new() -> Self {
        Self {
            workspaces: HashMap::new(),
        }
    }

    pub fn reset(&mut self) {
        // Drop will clean up debouncer and fs_ops
        self.workspaces.clear();
    }

    pub async fn watch_workspace(
        &mut self,
        path: impl AsRef<Path>,
        id: &str,
        on_event: impl OnEvent + 'static,
        // hack: we need to pass the manager to the callback, so we pass in
        // a clone of the manager Arc from the Tauri state
        manager_clone: Arc<tokio::sync::Mutex<Option<WorkspaceManager>>>,
    ) -> Result<(), WorkspaceError> {
        if self.workspaces.contains_key(id) {
            return Err(WorkspaceError::WorkspaceAlreadyWatched {
                workspace_id: id.to_string(),
            });
        }

        let on_event = Arc::new(on_event);

        let id_clone = id.to_string();
        let mut debouncer = new_debouncer(
            // 75ms is fast enough to make the UI feel responsive, but not too fast that
            // we fail to debounce or combine events
            Duration::from_millis(75),
            None,
            move |events_result: DebounceEventResult| {
                let manager_clone = manager_clone.clone();
                let id_clone = id_clone.clone();

                // the debouncer runs on a separate vanilla thread
                run_async_command(async move {
                    if let Some(manager) = manager_clone.lock().await.as_mut() {
                        match events_result {
                            Ok(events) => {
                                manager.handle_file_events(&id_clone, events).await;
                            }
                            Err(errors) => {
                                manager.handle_file_errors(&id_clone, errors).await;
                            }
                        }
                    }
                });
            },
        )
        .map_err(|e| WorkspaceError::WatchError {
            workspace_id: id.to_string(),
            message: e.to_string(),
        })?;

        let fs_ops = FsOpsHandle::new();
        let state =
            WorkspaceState::new(id, &path)
                .await
                .map_err(|e| WorkspaceError::WorkspaceReadError {
                    path: path.as_ref().to_path_buf(),
                    message: e.to_string(),
                });

        on_event(state.clone().into());

        if let Ok(state) = &state {
            for runbook_id in state.runbooks.keys() {
                on_event(WorkspaceEvent::RunbookChanged(runbook_id.clone()));
            }
        }

        // Use selective watching with ignore patterns instead of recursive watching
        self.setup_selective_watching(&mut debouncer, path.as_ref(), id)?;

        let ws = Workspace {
            id: id.to_string(),
            state,
            histories: HashMap::new(),
            path: path.as_ref().to_path_buf(),
            _debouncer: debouncer,
            fs_ops,
            on_event,
        };

        self.workspaces.insert(id.to_string(), ws);

        Ok(())
    }

    pub async fn unwatch_workspace(&mut self, id: &str) -> Result<(), WorkspaceError> {
        // Drop will clean up debouncer and fs_ops
        self.workspaces.remove(id);
        Ok(())
    }

    pub async fn create_workspace(
        &mut self,
        path: impl AsRef<Path>,
        id: &str,
        name: &str,
    ) -> Result<(), WorkspaceError> {
        FsOps::create_workspace(path, id, name).await.map_err(|e| {
            WorkspaceError::WorkspaceCreateError {
                workspace_id: id.to_string(),
                message: e.to_string(),
            }
        })
    }

    pub async fn rename_workspace(&mut self, id: &str, name: &str) -> Result<(), WorkspaceError> {
        let workspace = self.get_workspace(id)?;
        workspace.rename(name).await
    }

    pub async fn create_runbook(
        &mut self,
        workspace_id: &str,
        parent_folder_id: Option<&str>,
    ) -> Result<String, WorkspaceError> {
        let workspace = self.get_workspace(workspace_id)?;
        workspace.create_runbook(parent_folder_id).await
    }

    pub async fn save_runbook(
        &mut self,
        workspace_id: &str,
        runbook_id: &str,
        name: &str,
        content: Value,
    ) -> Result<String, WorkspaceError> {
        let workspace = self.get_workspace(workspace_id)?;
        workspace
            .save_runbook(runbook_id, name, &content, None::<&Path>)
            .await
    }

    pub async fn delete_runbook(
        &mut self,
        workspace_id: &str,
        runbook_id: &str,
    ) -> Result<(), WorkspaceError> {
        let workspace = self.get_workspace(workspace_id)?;
        workspace.delete_runbook(runbook_id).await
    }

    pub async fn get_runbook(
        &mut self,
        runbook_id: &str,
    ) -> Result<OfflineRunbook, WorkspaceError> {
        let workspace = self.workspaces.values_mut().find(|w| {
            w.state
                .as_ref()
                .map(|s| s.runbooks.contains_key(runbook_id))
                .unwrap_or(false)
        });

        if let Some(workspace) = workspace {
            workspace.get_runbook(runbook_id).await
        } else {
            Err(WorkspaceError::GenericWorkspaceError {
                message: format!("Runbook {runbook_id} not found"),
            })
        }
    }

    pub async fn create_folder(
        &mut self,
        workspace_id: &str,
        parent_path: Option<&str>,
        name: &str,
    ) -> Result<PathBuf, WorkspaceError> {
        let workspace = self.get_workspace(workspace_id)?;
        workspace
            .create_folder(parent_path.map(Path::new), name)
            .await
    }

    pub async fn rename_folder(
        &mut self,
        workspace_id: &str,
        folder_id: &str,
        new_name: &str,
    ) -> Result<(), WorkspaceError> {
        let workspace = self.get_workspace(workspace_id)?;
        workspace.rename_folder(folder_id, new_name).await
    }

    pub async fn delete_folder(
        &mut self,
        workspace_id: &str,
        folder_id: &str,
    ) -> Result<(), WorkspaceError> {
        let workspace = self.get_workspace(workspace_id)?;
        workspace.delete_folder(folder_id).await
    }

    pub async fn move_items(
        &mut self,
        workspace_id: &str,
        item_ids: &[String],
        new_parent: Option<&str>,
    ) -> Result<(), WorkspaceError> {
        let workspace = self.get_workspace(workspace_id)?;
        workspace.move_items(item_ids, new_parent).await
    }

    pub async fn get_dir_info(
        &mut self,
        workspace_id: &str,
    ) -> Result<WorkspaceDirInfo, WorkspaceError> {
        let workspace = self.get_workspace(workspace_id)?;
        workspace.get_dir_info().await
    }

    async fn rescan_workspace(&self, workspace_id: &str) -> Result<WorkspaceState, WorkspaceError> {
        if let Some(workspace) = self.workspaces.get(workspace_id) {
            workspace.rescan().await
        } else {
            Err(WorkspaceError::WorkspaceNotWatched {
                workspace_id: workspace_id.to_string(),
            })
        }
    }

    async fn handle_file_events(&mut self, workspace_id: &str, events: Vec<DebouncedEvent>) {
        if !self.workspaces.contains_key(workspace_id) {
            return;
        }

        log::debug!(
            "Handling {} file events for workspace {}",
            events.len(),
            workspace_id
        );
        let mut full_rescan = false;

        if self
            .workspaces
            .get(workspace_id)
            .map(|w| w.state.is_err())
            .unwrap_or(false)
        {
            full_rescan = true;
        }

        let mut known_events = HashSet::new();

        for event in events {
            // break early if the workspace is in an error state
            if full_rescan {
                break;
            }

            // returns true if notify detects some events may have been missed
            if event.need_rescan() {
                full_rescan = true;
                break;
            }

            let has_relevant_paths = event.paths.iter().any(|path| {
                if let Some(workspace) = self.workspaces.get(workspace_id) {
                    let gitignore = create_ignore_matcher(&workspace.path).ok();
                    !should_ignore_path(path, &workspace.path, gitignore.as_ref())
                        && is_relevant_file(path)
                } else {
                    false
                }
            });

            if !has_relevant_paths {
                log::debug!("Skipping irrelevant paths: {:?}", event.paths);
                continue;
            }

            log::debug!(
                "Processing relevant event: {:?} for paths: {:?}",
                event.event.kind,
                event.paths
            );

            match event.event.kind {
                EventKind::Access(_) => {}
                EventKind::Modify(kind) => {
                    if matches!(kind, ModifyKind::Name(_)) {
                        full_rescan = true;
                        break;
                    }

                    if let Some(path) = event.paths.first() {
                        if let Some(workspace) = self.workspaces.get_mut(workspace_id) {
                            if workspace.path.join("atuin.toml") == *path {
                                full_rescan = true;
                                break;
                            }

                            let matching_runbook = workspace
                                .state
                                .as_ref()
                                .ok()
                                .and_then(|s| s.runbooks.values().find(|r| r.path == *path));

                            if let Some(runbook) = matching_runbook {
                                known_events
                                    .insert(WorkspaceEvent::RunbookChanged(runbook.id.clone()));
                            }
                        }
                    }
                }
                EventKind::Create(_) | EventKind::Remove(_) => {
                    // Handle directory creation/deletion
                    if let Some(path) = event.paths.first() {
                        match event.event.kind {
                            EventKind::Create(_) if path.is_dir() => {
                                if let Some(workspace) = self.workspaces.get_mut(workspace_id) {
                                    let gitignore = create_ignore_matcher(&workspace.path).ok();
                                    if !should_ignore_path(
                                        path,
                                        &workspace.path,
                                        gitignore.as_ref(),
                                    ) {
                                        log::debug!(
                                            "Adding watcher for new directory: {}",
                                            path.display()
                                        );
                                        if let Err(e) = workspace
                                            ._debouncer
                                            .watch(path, RecursiveMode::NonRecursive)
                                        {
                                            log::warn!(
                                                "Failed to watch new directory {}: {}",
                                                path.display(),
                                                e
                                            );
                                        }
                                    }
                                }
                            }
                            EventKind::Remove(_) => {
                                // Remove watcher for deleted directory/file
                                if let Some(workspace_mut) = self.workspaces.get_mut(workspace_id) {
                                    log::debug!(
                                        "Removing watcher for deleted path: {}",
                                        path.display()
                                    );
                                    if let Err(e) = workspace_mut._debouncer.unwatch(path) {
                                        log::debug!("Failed to unwatch deleted path {} (this is normal): {}", path.display(), e);
                                    }
                                }
                            }
                            _ => {}
                        }
                    }
                    full_rescan = true;
                    break;
                }
                _ => {
                    // TODO: this could probably be smarter/more granular in the future,
                    // but there are enough edge cases that for now we just do a full rescan
                    full_rescan = true;
                    break;
                }
            }
        }

        if full_rescan {
            self.rescan_and_notify(workspace_id, Some(known_events))
                .await;
        } else {
            self.notify(workspace_id, known_events);
        }
    }

    async fn handle_file_errors(
        &mut self,
        workspace_id: &str,
        _errors: Vec<notify_debouncer_full::notify::Error>,
    ) {
        if !self.workspaces.contains_key(workspace_id) {
            return;
        }

        self.rescan_and_notify(workspace_id, None).await;
    }

    async fn rescan_and_notify(
        &mut self,
        workspace_id: &str,
        known_events: Option<HashSet<WorkspaceEvent>>,
    ) {
        let mut known_events = known_events.unwrap_or_default();

        match self.rescan_workspace(workspace_id).await {
            Ok(updated) => {
                if let Some(workspace) = self.workspaces.get_mut(workspace_id) {
                    if let Ok(state) = &workspace.state {
                        // since we're doing a full rescan, use runbook file metadata to figure out which changed
                        for (id, runbook) in updated.runbooks.iter() {
                            if let Some(workspace_runbook) = state.runbooks.get(id) {
                                if workspace_runbook.lastmod != runbook.lastmod {
                                    known_events.insert(WorkspaceEvent::RunbookChanged(id.clone()));
                                }
                            } else {
                                // runbook is new to the workspace
                                known_events.insert(WorkspaceEvent::RunbookChanged(id.clone()));
                            }
                        }

                        for (id, _runbook) in state.runbooks.iter() {
                            if !updated.runbooks.contains_key(id) {
                                known_events.insert(WorkspaceEvent::RunbookDeleted(id.clone()));
                            }
                        }
                    } else {
                        // If the workspace was in an error state previously,
                        // we should notify about every runbook that exists in the new state
                        for (id, _runbook) in updated.runbooks.iter() {
                            known_events.insert(WorkspaceEvent::RunbookChanged(id.clone()));
                        }
                    }

                    workspace.state = Ok(updated);
                    (workspace.on_event)(workspace.state.clone().into());
                }
            }
            Err(e) => {
                if let Some(workspace) = self.workspaces.get_mut(workspace_id) {
                    workspace.state = Err(e);

                    (workspace.on_event)(workspace.state.clone().into());
                }
            }
        }

        self.notify(workspace_id, known_events);
    }

    fn notify(&self, workspace_id: &str, events: HashSet<WorkspaceEvent>) {
        if let Some(workspace) = self.workspaces.get(workspace_id) {
            for event in events {
                (workspace.on_event)(event);
            }
        }
    }

    pub async fn shutdown(&mut self) {
        self.reset();
    }

    fn get_workspace(&mut self, id: &str) -> Result<&mut Workspace, WorkspaceError> {
        self.workspaces
            .get_mut(id)
            .ok_or(WorkspaceError::WorkspaceNotWatched {
                workspace_id: id.to_string(),
            })
    }

    fn setup_selective_watching(
        &self,
        debouncer: &mut notify_debouncer_full::Debouncer<
            notify_debouncer_full::notify::RecommendedWatcher,
            notify_debouncer_full::RecommendedCache,
        >,
        root_path: &Path,
        workspace_id: &str,
    ) -> Result<(), WorkspaceError> {
        log::debug!(
            "Setting up selective watching for workspace {} at {}",
            workspace_id,
            root_path.display()
        );

        // TODO: This is a single threaded walker. Investigate perf bonus of a parallel walker
        let walker = create_ignore_walker(root_path).build();

        let mut watched_count = 0;
        for entry in walker.filter_map(Result::ok) {
            let path = entry.path();
            if path.is_dir() {
                log::debug!("Watching directory: {}", path.display());
                debouncer
                    .watch(path, RecursiveMode::NonRecursive)
                    .map_err(|e| WorkspaceError::WatchError {
                        workspace_id: workspace_id.to_string(),
                        message: format!("Failed to watch directory {}: {}", path.display(), e),
                    })?;
                watched_count += 1;
            }
        }

        log::info!("Watching {watched_count} directories for workspace {workspace_id}",);
        Ok(())
    }
}

fn is_relevant_file(path: impl AsRef<Path>) -> bool {
    let path = path.as_ref();

    // Only check if this is content we care about (not ignore logic)
    path.is_dir()
        || !path.exists() // If the file doesn't exist, we may have deleted it
        || path
            .file_name()
            .map(|f| f.to_string_lossy().eq_ignore_ascii_case("atuin.toml"))
            .unwrap_or(false)
        || path
            .extension()
            .map(|f| f.to_string_lossy().eq_ignore_ascii_case("atrb"))
            .unwrap_or(false)
}
