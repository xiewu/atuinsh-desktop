use std::{path::PathBuf, str::FromStr, time::Duration};

use eyre::Result;
use sqlx::{migrate::MigrateDatabase, sqlite, Pool, Sqlite, SqlitePool};
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

pub(crate) fn db_file(app: &AppHandle, database: &str) -> String {
    let state = app.state::<crate::state::AtuinState>();
    let dev_prefix = state.dev_prefix.as_ref();

    let ext = if database.ends_with(".db") { "" } else { ".db" };

    dev_prefix.map_or(format!("{}{}", database, ext), |prefix| {
        format!("{}_{}{}", prefix, database, ext)
    })
}

pub(crate) fn db_path(app: &AppHandle, database: &str) -> PathBuf {
    let app_path = app
        .path()
        .app_config_dir()
        .expect("Failed to get app config dir");

    app_path.join(db_file(app, database))
}

/// Get a pool for the given database. If the database does not exist, it will be created.
/// Database files are stored in the app config directory (`app.path().app_config_dir()`)
/// to match the behavior of `tauri-plugin-sql`.
///
/// If the database name does not end in `.db`, it will be appended automatically.
pub(crate) async fn get_pool(app: &AppHandle, database: &str) -> Result<Pool<Sqlite>> {
    let db_path = db_path(app, database);

    let create = !db_path.exists();
    if create {
        if let Some(dir) = db_path.parent() {
            create_dir_all(dir).await?;
        }
    }

    let opts = sqlite::SqliteConnectOptions::from_str(db_path.to_str().unwrap())?
        .journal_mode(sqlite::SqliteJournalMode::Wal)
        .optimize_on_close(true, None)
        .synchronous(sqlite::SqliteSynchronous::Normal)
        .with_regexp()
        .create_if_missing(true);

    let pool = sqlite::SqlitePoolOptions::new()
        .acquire_timeout(Duration::from_secs_f64(3.0))
        .connect_with(opts)
        .await?;

    Ok(pool)
}
