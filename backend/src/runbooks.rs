use sqlx::Row;
use tauri::{AppHandle, Manager};

#[tauri::command]
pub async fn save_ydoc_for_runbook(
    app: AppHandle,
    request: tauri::ipc::Request<'_>,
) -> Result<(), String> {
    if let tauri::ipc::InvokeBody::Raw(data) = request.body() {
        let db_path = request.headers().get("db").unwrap().to_str().unwrap();
        let runbook_id = request.headers().get("id").unwrap().to_str().unwrap();

        let data_path = app.path().app_local_data_dir().unwrap();
        let db = sqlx::sqlite::SqlitePool::connect(data_path.join(db_path).to_str().unwrap())
            .await
            .unwrap();

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
    db_path: &str,
    runbook_id: &str,
) -> Result<tauri::ipc::Response, String> {
    let data_path = app.path().app_local_data_dir().unwrap();
    let db = sqlx::sqlite::SqlitePool::connect(data_path.join(db_path).to_str().unwrap())
        .await
        .unwrap();

    let result = sqlx::query("select ydoc from runbooks where id = ?1")
        .bind(runbook_id)
        .fetch_one(&db)
        .await
        .unwrap();

    let data = result.get::<Vec<_>, _>("ydoc");

    Ok(tauri::ipc::Response::new(data))
}
