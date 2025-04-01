ALTER TABLE legacy_workspaces
RENAME TO workspaces;

ALTER TABLE runbooks
RENAME COLUMN legacy_workspace_id TO workspace_id;
