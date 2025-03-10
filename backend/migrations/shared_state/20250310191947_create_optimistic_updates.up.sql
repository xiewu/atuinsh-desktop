CREATE TABLE
  optimistic_updates (
    id STRING PRIMARY KEY,
    document_name STRING NOT NULL,
    delta STRING NOT NULL,
    change_ref STRING UNIQUE NOT NULL,
    source_version INTEGER NOT NULL,
    FOREIGN KEY (document_name) REFERENCES documents (name) ON DELETE CASCADE
  );

CREATE INDEX idx_optimistic_updates_document_name ON optimistic_updates (document_name);

CREATE UNIQUE INDEX idx_optimistic_updates_change_ref ON optimistic_updates (change_ref);
