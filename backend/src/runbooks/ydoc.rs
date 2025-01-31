use sqlx::sqlite::SqlitePool;
use sqlx::Row;
use tauri::ipc::{InvokeBody, Request, Response};
use tauri::{AppHandle, Manager};

use crate::state;

#[tauri::command]
pub async fn save_ydoc_for_runbook(
    app: AppHandle,
    state: tauri::State<'_, state::AtuinState>,
    request: Request<'_>,
) -> Result<(), String> {
    if let InvokeBody::Raw(data) = request.body() {
        let runbook_id = request.headers().get("id").unwrap().to_str().unwrap();

        let db_file = get_db_file(&app, state.dev_prefix.as_ref());
        let db = SqlitePool::connect(&db_file).await.unwrap();

        sqlx::query("update runbooks set ydoc = ?1 where id = ?2")
            .bind(data)
            .bind(runbook_id)
            .execute(&db)
            .await
            .unwrap();

        Ok(())
    } else {
        Err("Something went wrong".to_string())
    }
}

#[tauri::command]
pub async fn load_ydoc_for_runbook(
    app: AppHandle,
    state: tauri::State<'_, state::AtuinState>,
    runbook_id: &str,
) -> Result<Response, String> {
    let db_file = get_db_file(&app, state.dev_prefix.as_ref());
    let db = SqlitePool::connect(&db_file).await.unwrap();

    let result = sqlx::query("select ydoc from runbooks where id = ?1")
        .bind(runbook_id)
        .fetch_one(&db)
        .await
        .unwrap();

    let data = result.get::<Vec<_>, _>("ydoc");

    Ok(Response::new(data))
}

fn get_db_file(app: &AppHandle, dev_prefix: Option<&String>) -> String {
    let data_path = app.path().app_config_dir().unwrap();
    let data_file = dev_prefix.map_or("runbooks.db".to_string(), |prefix| {
        format!("{}_runbooks.db", prefix)
    });

    data_path.join(data_file).to_str().unwrap().to_string()
}
