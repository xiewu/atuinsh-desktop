CREATE TABLE
  documents (
    id STRING PRIMARY KEY,
    name STRING UNIQUE NOT NULL,
    value STRING NOT NULL,
    version INTEGER NOT NULL
  );

CREATE UNIQUE INDEX idx_documents_name ON documents (name);
