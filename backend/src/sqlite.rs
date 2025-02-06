use sqlx::{migrate::MigrateDatabase, Pool, Sqlite, SqlitePool};
use tauri::{AppHandle, Manager};
use tokio::fs::create_dir_all;

pub(crate) async fn connect(database: &str, app: &AppHandle) -> Result<Pool<Sqlite>, String> {
    let state = app.state::<crate::state::AtuinState>();
    let dev_prefix = state.dev_prefix.as_ref();

    let db_file = dev_prefix.map_or(database.to_string(), |prefix| {
        format!("{}_{}", prefix, database)
    });

    let app_path = app
        .path()
        .app_config_dir()
        .expect("Failed to get app config dir");

    create_dir_all(&app_path).await.map_err(|e| e.to_string())?;

    let conn_url = &format!("sqlite:{}", app_path.join(db_file).to_str().unwrap());

    if !Sqlite::database_exists(conn_url).await.unwrap_or(false) {
        Sqlite::create_database(conn_url)
            .await
            .map_err(|e| e.to_string())?;
    }

    SqlitePool::connect(conn_url)
        .await
        .map_err(|e| e.to_string())
}
