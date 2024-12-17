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
        },
        Migration {
            version: 4,
            description: "add_workspace_directory",
            sql: "alter table workspaces add column watch_dir string;",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "add_ydoc_to_runbooks",
            sql: "alter table runbooks add column ydoc blob;",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "create_snapshots_table",
            sql: "CREATE TABLE snapshots(id STRING PRIMARY KEY, runbook_id STRING, tag TEXT, content TEXT, created BIGINT);",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "add_source_info_to_runbooks",
            sql: "ALTER TABLE runbooks ADD COLUMN source TEXT, ADD COLUMN source_info TEXT, ADD COLUMN forked_from STRING;",
            kind: MigrationKind::Up,
        },
    ]
}
