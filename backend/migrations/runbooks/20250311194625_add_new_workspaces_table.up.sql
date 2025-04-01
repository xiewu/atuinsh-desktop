CREATE TABLE
  workspaces (
    id TEXT PRIMARY KEY,
    name TEXT,
    org_id TEXT,
    permissions TEXT,
    created BIGINT,
    updated BIGINT
  );

ALTER TABLE runbooks
ADD COLUMN workspace_id TEXT;
