use tauri_plugin_sql::{Migration, MigrationKind};

pub fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create_initial_tables",
            sql: "CREATE TABLE runbooks(id string PRIMARY KEY, name TEXT, content TEXT, created bigint, updated bigint);",
            kind: MigrationKind::Up,
        }
    ]
}
