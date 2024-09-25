use tauri_plugin_sql::{Migration, MigrationKind};

pub fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create_initial_tables",
            sql: "CREATE TABLE runbooks(id string PRIMARY KEY, name TEXT, content TEXT, created bigint, updated bigint);",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create_workspace_table",
            sql: "create table workspaces(id string primary key, name text, created bigint, updated bigint);",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "add_workspace_id_to_runbooks",
            sql: "alter table runbooks add column workspace_id string;",
            kind: MigrationKind::Up,
        }
    ]
}
