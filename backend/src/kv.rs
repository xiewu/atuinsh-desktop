use serde::{de::DeserializeOwned, Serialize};
use sqlx::{Row, SqlitePool};
use tauri::AppHandle;

pub(crate) async fn get<T: DeserializeOwned>(
    app: &AppHandle,
    key: &str,
) -> Result<Option<T>, String> {
    let db = open_db(app).await?;
    let res = sqlx::query("select value from kv where key = $1")
        .bind(key)
        .fetch_optional(&db)
        .await
        .map_err(|e| e.to_string());

    match res {
        Ok(Some(row)) => {
            let value_str: String = row.get("value");
            serde_json::from_str(&value_str)
                .map(Some)
                .map_err(|e| e.to_string())
        }
        Ok(None) => Ok(None),
        Err(e) => Err(e),
    }
}

pub(crate) async fn set<T: Serialize>(app: &AppHandle, key: &str, value: &T) -> Result<(), String> {
    let db = open_db(app).await?;
    sqlx::query("insert or replace into kv(key, value) values($1, $2)")
        .bind(key)
        .bind(serde_json::to_string(value).map_err(|e| e.to_string())?)
        .execute(&db)
        .await
        .map(|_| ())
        .map_err(|e| e.to_string())
}

async fn open_db(app: &AppHandle) -> Result<SqlitePool, String> {
    let db = crate::sqlite::connect("kv.db", app).await?;
    sqlx::query("CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT)")
        .execute(&db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(db)
}
