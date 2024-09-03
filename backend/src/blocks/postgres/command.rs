use std::collections::HashMap;

use serde_json::Value as JsonValue;
use sqlx::{Column, Connection, PgConnection, Row};

// At present, we pass in a URI and connect to it here. In future, I'd love
// to maintain a connection pool and not constantly reconnect. But for now,
// this is fine.
//
// It might also be nice to be able to create named database configs, and just
// reference them in blocks. I do think it's important to support ad-hoc connections
// though, so let's do those first.
#[tauri::command]
pub async fn postgres_query(
    uri: String,
    query: String,
    values: Vec<JsonValue>,
) -> Result<Vec<HashMap<String, JsonValue>>, String> {
    let mut conn = PgConnection::connect(uri.as_str())
        .await
        .map_err(|e| e.to_string())?;

    let mut query = sqlx::query(&query);
    for value in values {
        if value.is_null() {
            query = query.bind(None::<JsonValue>);
        } else if value.is_string() {
            query = query.bind(value.as_str().unwrap().to_owned())
        } else {
            query = query.bind(value);
        }
    }
    let rows = query
        .fetch_all(&mut conn)
        .await
        .map_err(|e| e.to_string())?;

    let mut values = Vec::new();
    for row in rows {
        let mut value = HashMap::default();
        for (i, column) in row.columns().iter().enumerate() {
            let v = row.try_get_raw(i).map_err(|e| e.to_string())?;

            let v = super::decode::to_json(v).map_err(|e| e.to_string())?;

            value.insert(column.name().to_string(), v);
        }

        values.push(value);
    }

    Ok(values)
}

#[tauri::command]
pub async fn postgres_execute() -> Result<String, String> {
    Ok("Hello from postgres.rs".to_string())
}
