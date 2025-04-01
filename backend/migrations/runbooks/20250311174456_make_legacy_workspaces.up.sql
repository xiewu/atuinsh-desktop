ALTER TABLE runbooks
RENAME COLUMN workspace_id TO legacy_workspace_id;

ALTER TABLE workspaces
RENAME TO legacy_workspaces;
