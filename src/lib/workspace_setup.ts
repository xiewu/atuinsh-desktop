import Workspace from "@/state/runbooks/workspace";
import { useStore } from "@/state/store";
import * as api from "@/api/api";
import Operation from "@/state/runbooks/operation";
import Runbook from "@/state/runbooks/runbook";
import LegacyWorkspace from "@/state/runbooks/legacy_workspace";
import WorkspaceFolder, { Folder } from "@/state/runbooks/workspace_folders";
import { SharedStateManager } from "./shared_state/manager";
import { AtuinSharedStateAdapter } from "./shared_state/adapter";
import { uuidv7 } from "uuidv7";
import Logger from "./logger";
import { Rc } from "@binarymuse/ts-stdlib";
import welcome from "@/state/runbooks/welcome.json";
import { SET_RUNBOOK_TAG } from "@/state/store/runbook_state";
const logger = new Logger("WorkspaceMigration");

let resolve: (() => void) | null = null;
let setupPromise: Promise<void> | null = null;

export default async function doWorkspaceSetup(): Promise<void> {
  // This is a bit of a hack to ensure that we only run the workspace setup once,
  // even if React runs the effect twice.
  if (setupPromise) {
    return setupPromise;
  }

  setupPromise = new Promise<void>((res) => {
    resolve = res;
  });

  const { currentWorkspaceId, setCurrentWorkspaceId, setCurrentRunbookId } = useStore.getState();

  // Ensure at least one workspace exists
  const workspaces = await Workspace.all();
  const legacyWorkspaces = await LegacyWorkspace.all();
  if (workspaces.length === 0) {
    logger.info("No workspaces found; attempting to fetch from server...");
    let workspace;
    try {
      const server_wss = await api.getWorkspaces();
      const server_ws = server_wss.find((ws) => ws.owner.type === "user");
      if (!server_ws) {
        throw new Error("No user workspace found");
      }

      workspace = new Workspace({
        id: server_ws.id,
        name: server_ws.name,
        permissions: server_ws.permissions,
      });
      await workspace.save();
    } catch (err) {
      logger.info("Unable to fetch workspaces from server; creating default workspace");

      workspace = new Workspace({
        id: uuidv7(),
        name: "Default Workspace",
      });
      await workspace.save();

      // Create an operation so that we eventually sync our default workspace's ID
      // with the users's default workspace created on the server.
      //
      // This is only necessary if the user already has legacy workspaces locally.
      // Otherwise, the user's new local workspace will be pushed to the server,
      // and the client will pull down the server's workspace.
      if (legacyWorkspaces.length > 0) {
        const op = new Operation({
          operation: {
            type: "workspace_created_default",
            workspaceId: workspace.get("id")!,
          },
        });
        await op.save();
      } else {
        const op = new Operation({
          operation: {
            type: "workspace_created",
            workspaceId: workspace.get("id")!,
            workspaceName: workspace.get("name")!,
            workspaceOwner: { type: "user" },
          },
        });
        await op.save();
      }
    }

    workspaces.push(workspace);

    // Set the workspace_id for ALL runbooks to the newly created workspace
    await Runbook.updateAll({ workspaceId: workspace.get("id")! });

    // Create the default organization structure based off the legacy workspaces
    const runbooks = await Runbook.allInAllWorkspaces();

    if (legacyWorkspaces.length > 0 || runbooks.length > 0) {
      const stateManager = SharedStateManager.getInstance<Folder>(
        `workspace-folder:${workspace.get("id")}`,
        new AtuinSharedStateAdapter(`workspace-folder:${workspace.get("id")}`),
      );

      const changeRef = await stateManager.updateOptimistic((data) => {
        const legacyWorkspaceIds = new Set<string>(legacyWorkspaces.map((ws) => ws.id));
        const folder = WorkspaceFolder.fromJS(data);

        for (const legacyWs of legacyWorkspaces) {
          folder.createFolder(legacyWs.id, legacyWs.name, null);
        }

        for (const rb of runbooks) {
          const parentId = legacyWorkspaceIds.has(rb.legacyWorkspaceId)
            ? rb.legacyWorkspaceId
            : null;
          folder.createRunbook(rb.id, parentId);
        }

        return folder.toJS();
      });

      if (changeRef) {
        // Create an operation detailing the initial workspace folder layout
        const op = new Operation({
          operation: {
            type: "workspace_initial_folder_layout",
            workspaceId: workspace.get("id")!,
            changeRef: changeRef,
            data: stateManager.data,
          },
        });
        await op.save();
      }

      Rc.dispose(stateManager);
    }
  }

  if (!currentWorkspaceId || !workspaces.some((ws) => ws.get("id") === currentWorkspaceId)) {
    setCurrentWorkspaceId(workspaces[0].get("id")!);
  }

  const allRbIds = await Runbook.allIdsInAllWorkspaces();
  if (allRbIds.length === 0) {
    const workspace = workspaces[0];
    let runbook = await Runbook.create(workspace);

    runbook.name = "Welcome to Atuin!";
    runbook.content = JSON.stringify(welcome);
    await runbook.save();
    setCurrentRunbookId(runbook.id, SET_RUNBOOK_TAG);

    const manager = SharedStateManager.getInstance<Folder>(
      `workspace-folder:${workspace.get("id")}`,
      new AtuinSharedStateAdapter(`workspace-folder:${workspace.get("id")}`),
    );

    const changeRef = await manager.updateOptimistic((data) => {
      const folder = WorkspaceFolder.fromJS(data);
      folder.createRunbook(runbook.id, null);
      return folder.toJS();
    });

    const op = new Operation({
      operation: {
        type: "workspace_runbook_created",
        workspaceId: workspace.get("id")!,
        parentId: null,
        runbookId: runbook.id,
        changeRef: changeRef!,
      },
    });
    await op.save();

    Rc.dispose(manager);
  }

  useStore.getState().refreshRunbooks();
  resolve?.();
}
