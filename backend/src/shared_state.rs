use eyre::Result;
use sqlx::{QueryBuilder, Row, Sqlite, SqlitePool};
use tokio::sync::{mpsc, oneshot};
use uuid::Uuid;

use crate::state::AtuinState;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SharedStateDocument {
    value: serde_json::Value,
    version: i64,
    optimistic_updates: Vec<OptimisticUpdate>,
}

impl Default for SharedStateDocument {
    fn default() -> Self {
        Self {
            value: serde_json::Value::Object(serde_json::Map::new()),
            version: 0,
            optimistic_updates: vec![],
        }
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OptimisticUpdate {
    delta: serde_json::Value,
    change_ref: String,
    source_version: i64,
}

#[derive(Clone)]
pub struct SharedStateHandle {
    sender: mpsc::Sender<SharedStateMessage>,
}

impl SharedStateHandle {
    pub async fn new(db_pool: SqlitePool) -> Self {
        let (sender, receiver) = mpsc::channel(8);

        let (ready_sender, ready_receiver) = oneshot::channel();

        tauri::async_runtime::spawn(async move {
            let mut actor = SharedState::new(db_pool, receiver)
                .await
                .expect("Failed to create shared state");
            actor.run(ready_sender).await;
        });

        ready_receiver.await.unwrap();

        Self { sender }
    }

    pub async fn shutdown(&self) -> Result<()> {
        let (sender, receiver) = oneshot::channel();

        self.sender
            .send(SharedStateMessage::Shutdown { reply_to: sender })
            .await?;
        receiver.await?;

        Ok(())
    }

    pub async fn get_document(&self, name: String) -> Result<SharedStateDocument> {
        let (sender, receiver) = oneshot::channel();

        self.sender
            .send(SharedStateMessage::GetDocument {
                name,
                reply_to: sender,
            })
            .await?;
        receiver.await?
    }

    pub async fn update_document(
        &self,
        name: String,
        value: serde_json::Value,
        version: i64,
    ) -> Result<()> {
        let (sender, receiver) = oneshot::channel();

        self.sender
            .send(SharedStateMessage::UpdateDocument {
                name,
                value,
                version,
                reply_to: sender,
            })
            .await?;
        receiver.await?
    }

    pub async fn delete_document(&self, name: String) -> Result<()> {
        let (sender, receiver) = oneshot::channel();

        self.sender
            .send(SharedStateMessage::DeleteDocument {
                name,
                reply_to: sender,
            })
            .await?;
        receiver.await?
    }

    pub async fn push_optimistic_update(
        &self,
        name: String,
        update: OptimisticUpdate,
    ) -> Result<()> {
        let (sender, receiver) = oneshot::channel();

        self.sender
            .send(SharedStateMessage::PushOptimisticUpdate {
                name,
                update,
                reply_to: sender,
            })
            .await?;
        receiver.await?
    }

    pub async fn remove_optimistic_updates(
        &self,
        name: String,
        change_refs: Vec<String>,
    ) -> Result<()> {
        for chunk in change_refs.chunks(100) {
            let (sender, receiver) = oneshot::channel();
            self.sender
                .send(SharedStateMessage::RemoveOptimisticUpdates {
                    name: name.clone(),
                    change_refs: chunk.to_vec(),
                    reply_to: sender,
                })
                .await?;
            let _ = receiver.await?;
        }

        Ok(())
    }
}

pub struct SharedState {
    receiver: mpsc::Receiver<SharedStateMessage>,
    pool: SqlitePool,
}

impl SharedState {
    pub async fn new(
        pool: SqlitePool,
        receiver: mpsc::Receiver<SharedStateMessage>,
    ) -> Result<Self> {
        sqlx::migrate!("./migrations/shared_state")
            .run(&pool)
            .await?;

        Ok(Self { receiver, pool })
    }

    async fn run(&mut self, ready_sender: oneshot::Sender<()>) {
        use SharedStateMessage::*;

        ready_sender.send(()).unwrap();

        while let Some(msg) = self.receiver.recv().await {
            match msg {
                GetDocument { name, reply_to } => {
                    let document = self.get_state_document(name).await;
                    reply_to.send(document).unwrap();
                }
                UpdateDocument {
                    name,
                    value,
                    version,
                    reply_to,
                } => {
                    let res = self.update_document(name, value, version).await;
                    reply_to.send(res).unwrap();
                }
                DeleteDocument { name, reply_to } => {
                    let res = self.delete_document(name).await;
                    reply_to.send(res).unwrap();
                }
                PushOptimisticUpdate {
                    name,
                    update,
                    reply_to,
                } => {
                    let res = self.push_optimistic_update(name, update).await;
                    reply_to.send(res).unwrap();
                }
                RemoveOptimisticUpdates {
                    name,
                    change_refs,
                    reply_to,
                } => {
                    let res = self.remove_optimistic_updates(name, change_refs).await;
                    reply_to.send(res).unwrap();
                }
                Shutdown { reply_to } => {
                    self.pool.close().await;
                    reply_to.send(()).unwrap();
                    return;
                }
            }
        }
    }

    async fn get_state_document(&self, name: String) -> Result<SharedStateDocument> {
        let row = sqlx::query("SELECT value, version FROM documents WHERE name = ?")
            .bind(&name)
            .fetch_optional(&self.pool)
            .await?;

        if row.is_none() {
            sqlx::query("INSERT INTO documents (id, name, value, version) VALUES (?, ?, ?, ?)")
                .bind(Uuid::now_v7().to_string())
                .bind(&name)
                .bind(serde_json::Value::Object(serde_json::Map::new()))
                .bind(0)
                .execute(&self.pool)
                .await?;
        }

        let update_rows = match row {
            Some(_) => sqlx::query("SELECT delta, change_ref, source_version FROM optimistic_updates WHERE document_name = ? ORDER BY _ROWID_ ASC")
                .bind(&name)
                .fetch_all(&self.pool)
                .await?,
            None => vec![],
        };

        let document = row.map_or(SharedStateDocument::default(), |row| {
            let value: serde_json::Value = row.get("value");
            let version: i64 = row.get("version");

            let optimistic_updates = update_rows
                .into_iter()
                .map(|row| {
                    let delta: serde_json::Value = row.get("delta");
                    let change_ref: String = row.get("change_ref");
                    let source_version: i64 = row.get("source_version");

                    OptimisticUpdate {
                        delta,
                        change_ref,
                        source_version,
                    }
                })
                .collect();

            SharedStateDocument {
                value,
                version,
                optimistic_updates,
            }
        });

        Ok(document)
    }

    async fn update_document(
        &self,
        name: String,
        value: serde_json::Value,
        version: i64,
    ) -> Result<()> {
        let _ = sqlx::query("UPDATE documents SET value = ?, version = ? WHERE name = ?")
            .bind(&value)
            .bind(version)
            .bind(&name)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    async fn delete_document(&self, name: String) -> Result<()> {
        let _ = sqlx::query("DELETE FROM documents WHERE name = ?")
            .bind(&name)
            .execute(&self.pool)
            .await?;

        let _ = sqlx::query("DELETE FROM optimistic_updates WHERE document_name = ?")
            .bind(&name)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    async fn push_optimistic_update(&self, name: String, update: OptimisticUpdate) -> Result<()> {
        let _ = sqlx::query("INSERT INTO optimistic_updates (id, document_name, delta, change_ref, source_version) VALUES (?, ?, ?, ?, ?)")
            .bind(Uuid::now_v7().to_string())
            .bind(&name)
            .bind(&update.delta)
            .bind(&update.change_ref)
            .bind(update.source_version)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    async fn remove_optimistic_updates(
        &self,
        name: String,
        change_refs: Vec<String>,
    ) -> Result<()> {
        if change_refs.is_empty() {
            return Ok(());
        }

        // Unfortunately, SQLx doesn't currently support binding a vector for an IN clause, so we have to take a different approach.
        let mut builder: QueryBuilder<Sqlite> =
            QueryBuilder::new("DELETE FROM optimistic_updates WHERE document_name = ");
        builder.push_bind(&name);
        builder.push(" AND change_ref IN (");

        let mut sep = builder.separated(", ");
        for change_ref in &change_refs {
            sep.push_bind(change_ref);
        }
        sep.push_unseparated(")");

        let query = builder.build();
        let _ = query.execute(&self.pool).await?;

        Ok(())
    }
}

pub enum SharedStateMessage {
    GetDocument {
        name: String,
        reply_to: oneshot::Sender<Result<SharedStateDocument>>,
    },
    UpdateDocument {
        name: String,
        value: serde_json::Value,
        version: i64,
        reply_to: oneshot::Sender<Result<()>>,
    },
    DeleteDocument {
        name: String,
        reply_to: oneshot::Sender<Result<()>>,
    },
    PushOptimisticUpdate {
        name: String,
        update: OptimisticUpdate,
        reply_to: oneshot::Sender<Result<()>>,
    },
    RemoveOptimisticUpdates {
        name: String,
        change_refs: Vec<String>,
        reply_to: oneshot::Sender<Result<()>>,
    },
    Shutdown {
        reply_to: oneshot::Sender<()>,
    },
}

#[tauri::command]
pub async fn get_shared_state_document(
    state: tauri::State<'_, AtuinState>,
    name: String,
) -> std::result::Result<SharedStateDocument, String> {
    let document = state
        .shared_state()
        .get_document(name)
        .await
        .map_err(|e| e.to_string())?;
    Ok(document)
}

#[tauri::command]
pub async fn push_optimistic_update(
    state: tauri::State<'_, AtuinState>,
    name: String,
    update: OptimisticUpdate,
) -> Result<(), String> {
    state
        .shared_state()
        .push_optimistic_update(name, update)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn update_shared_state_document(
    state: tauri::State<'_, AtuinState>,
    name: String,
    value: serde_json::Value,
    version: i64,
) -> Result<(), String> {
    state
        .shared_state()
        .update_document(name, value, version)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn delete_shared_state_document(
    state: tauri::State<'_, AtuinState>,
    name: String,
) -> Result<(), String> {
    state
        .shared_state()
        .delete_document(name)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn remove_optimistic_updates(
    state: tauri::State<'_, AtuinState>,
    name: String,
    change_refs: Vec<String>,
) -> Result<(), String> {
    state
        .shared_state()
        .remove_optimistic_updates(name, change_refs)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}
