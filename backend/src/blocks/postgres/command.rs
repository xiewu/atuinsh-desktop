use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use sqlx::{Column, Connection, PgConnection, Row};

#[derive(Debug, Default, Serialize, Deserialize)]
struct PostgresColumn {
    name: String,
    type_: String,
}

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct PostgresQueryResult {
    columns: Vec<PostgresColumn>,
    rows: Vec<Vec<JsonValue>>,
}

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct PostgresExecuteResult {
    rows_affected: u64,
}

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
    values: Option<Vec<JsonValue>>,
) -> Result<PostgresQueryResult, String> {
    let mut conn = PgConnection::connect(uri.as_str())
        .await
        .map_err(|e| e.to_string())?;

    let mut query = sqlx::query(&query);
    for value in values.unwrap_or_default() {
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

    if rows.is_empty() {
        return Ok(PostgresQueryResult::default());
    }

    let columns = rows[0]
        .columns()
        .iter()
        .map(|c| PostgresColumn {
            name: c.name().to_owned(),
            type_: c.type_info().to_string(),
        })
        .collect();

    let mut values = Vec::new();

    for row in rows {
        let mut value = Vec::default();

        for (i, _) in row.columns().iter().enumerate() {
            let v = row.try_get_raw(i).map_err(|e| e.to_string())?;
            let v = super::decode::to_json(v).map_err(|e| e.to_string())?;

            value.push(v);
        }

        values.push(value);
    }

    Ok(PostgresQueryResult {
        rows: values,
        columns,
    })
}

#[tauri::command]
pub async fn postgres_execute(
    uri: String,
    query: String,
    values: Option<Vec<JsonValue>>,
) -> Result<PostgresExecuteResult, String> {
    let mut conn = PgConnection::connect(uri.as_str())
        .await
        .map_err(|e| e.to_string())?;

    let mut query = sqlx::query(&query);
    for value in values.unwrap_or_default() {
        if value.is_null() {
            query = query.bind(None::<JsonValue>);
        } else if value.is_string() {
            query = query.bind(value.as_str().unwrap().to_owned())
        } else {
            query = query.bind(value);
        }
    }
    let res = query.execute(&mut conn).await.map_err(|e| e.to_string())?;

    Ok(PostgresExecuteResult {
        rows_affected: res.rows_affected(),
    })
}
