import Workspace from "@/state/runbooks/workspace";
import { ArboristNode, ArboristTree } from "@/state/runbooks/workspace_folders";
import { Menu, MenuOptions } from "@tauri-apps/api/menu";

type Handler = () => void;

type Actions = {
  onNewRunbook: (workspaceId: string, parentFolderId: string | null) => void;
  onImportRunbook: (workspaceId: string | null, parentFolderId: string | null) => void;
};

export async function createNewRunbookMenu(
  workspaces: Array<{ workspace: Workspace; folder: ArboristTree }>,
  actions: Actions,
) {
  const workspaceItems = workspaces.map((ws) => ({
    id: ws.workspace.get("id"),
    text: ws.workspace.get("name"),
    items: buildWorkspaceItems(ws.workspace, ws.folder, actions),
  }));

  console.log("wsitems", workspaceItems);

  const menu = await Menu.new({
    items: [
      {
        id: "import_runbook",
        text: "Import Runbook",
        action: () => {
          actions.onImportRunbook(null, null);
        },
        accelerator: "CmdOrCtrl+I",
      },
      { item: "Separator" },
      ...workspaceItems,
    ],
  });

  return menu;
}

function buildWorkspaceItems(
  workspace: Workspace,
  folder: ArboristTree,
  actions: Actions,
): MenuOptions["items"] {
  const items = folder
    .filter((item) => item.type === "folder")
    .map((item) => {
      return {
        id: item.id,
        text: item.name || item.id,
        items: buildFolderItems(workspace, item, actions),
      };
    });
  console.log(items);

  return [
    {
      id: `new_runbook_${workspace.get("id")}`,
      text: "New Runbook Here",
      action: () => {
        actions.onNewRunbook(workspace.get("id")!, null);
      },
    },
    {
      id: `import_runbook_${workspace.get("id")}`,
      text: "Import Runbooks Here",
      action: () => {
        actions.onImportRunbook(workspace.get("id")!, null);
      },
    },
    { item: "Separator" },
    ...items,
  ];
}

function buildFolderItems(
  workspace: Workspace,
  folder: ArboristNode,
  actions: Actions,
): MenuOptions["items"] {
  if (!folder.children) {
    return [];
  }

  const items = folder.children
    .filter((item) => item.type === "folder")
    .map((item) => {
      return {
        id: item.id,
        text: item.name || item.id,
        items: buildFolderItems(workspace, item, actions),
      };
    });

  return [
    {
      id: `new_rb_${folder.id}`,
      text: "New Runbook Here",
      action: () => {
        actions.onNewRunbook(workspace.get("id")!, folder.id);
      },
    },
    {
      id: `import_rb_${folder.id}`,
      text: "Import Runbooks Here",
      action: () => {
        actions.onImportRunbook(workspace.get("id")!, folder.id);
      },
    },
    { item: "Separator" },
    ...items,
  ];
}
export async function createFolderMenu(actions: {
  onNewFolder: Handler;
  onRenameFolder: Handler;
  onDeleteFolder: Handler;
  onNewRunbook: Handler;
}) {
  const menu = await Menu.new({
    items: [
      {
        id: "new_folder",
        text: "New Folder",
        action: () => {
          // create new node and then edit it
          // props.node.edit();
          actions.onNewFolder();
        },
        accelerator: "N",
      },
      {
        id: "rename_folder",
        text: "Rename Folder",
        action: () => {
          actions.onRenameFolder();
        },
        accelerator: "R",
      },
      {
        id: "delete_folder",
        text: "Delete Folder",
        action: () => {
          actions.onDeleteFolder();
        },
        accelerator: "CmdOrCtrl+Delete",
      },
      {
        item: "Separator",
      },
      {
        id: "new_runbook",
        text: "New Runbook",
        action: () => {
          actions.onNewRunbook();
        },
        accelerator: "Shift+N",
      },
    ],
  });
  return menu;
}

export async function createRunbookMenu(actions: { onDeleteRunbook: Handler }) {
  const menu = await Menu.new({
    items: [
      {
        id: "delete_runbook",
        text: "Delete Runbook",
        action: () => {
          actions.onDeleteRunbook();
        },
        accelerator: "N",
      },
    ],
  });

  return menu;
}

export async function createWorkspaceMenu(actions: {
  onNewFolder: Handler;
  onNewRunbook: Handler;
  onNewWorkspace: Handler;
  onRenameWorkspace: Handler;
}) {
  const menu = await Menu.new({
    items: [
      {
        id: "new_folder",
        text: "New Folder",
        action: () => {
          actions.onNewFolder();
        },
        accelerator: "N",
      },
      {
        item: "Separator",
      },
      {
        id: "new_runbook",
        text: "New Runbook",
        action: () => {
          actions.onNewRunbook();
        },
        accelerator: "Shift+N",
      },
      {
        item: "Separator",
      },
      {
        id: "rename_workspace",
        text: "Rename Workspace",
        action: () => {
          actions.onRenameWorkspace();
        },
        accelerator: "R",
      },
      {
        id: "new_workspace",
        text: "New Workspace",
        action: () => {
          actions.onNewWorkspace();
        },
        accelerator: "CmdOrCtrl+N",
      },
    ],
  });

  return menu;
}
