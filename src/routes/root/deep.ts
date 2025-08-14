import { me, HttpResponseError, getRunbookID } from "@/api/api";
import RunbookSynchronizer, { SyncResult } from "@/lib/sync/runbook_synchronizer";
import Runbook from "@/state/runbooks/runbook";
import { useStore } from "@/state/store";
import { None, Option, Some } from "@binarymuse/ts-stdlib";

interface RouteHandler {
  (params: string[]): void;
}

interface Routes {
  [pattern: string]: RouteHandler;
}

async function createRunbookFromHub(id: string): Promise<Option<SyncResult>> {
  try {
    // If the runbook already exists locally, just return it
    const runbook = await Runbook.load(id);
    if (runbook) {
      return Some<SyncResult>({
        runbookId: runbook.id,
        action: "nothing",
      });
    }

    await getRunbookID(id);
    // It exists; kick off a sync
    const user = useStore.getState().user;
    const currentWorkspaceId = useStore.getState().currentWorkspaceId;
    const sync = new RunbookSynchronizer(id, currentWorkspaceId, user);
    const syncedRunbook = await sync.sync();
    return Some(syncedRunbook);
  } catch (err) {
    if (err instanceof HttpResponseError) {
      console.error("Failed to fetch runbook from hub:", err.code);
    } else {
      console.error("Failed to fetch runbook from hub:", err);
    }
  }

  return None;
}

const handleDeepLink = (
  url: string,
  runbookCreated: (
    runbookId: string,
    workspaceId: string,
    parentFolderId: string | null,
    activate?: boolean,
  ) => void,
): void | null => {
  const routes: Routes = {
    // New "Open in desktop" from the hub
    "^atuin://runbook/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$": async (
      params: string[],
    ) => {
      const [id] = params;

      let result = await createRunbookFromHub(id);

      if (result.isSome()) {
        let runbook = await Runbook.load(result.unwrap().runbookId);
        if (!runbook) {
          console.error("Unable to open runbook from hub");
          return;
        }
        runbookCreated(runbook.id, runbook.workspaceId, null, true);

        useStore.getState().refreshRunbooks();
      } else {
        console.error("Unable to open runbook from hub");
      }
    },

    // Register an auth token with this desktop app
    "^atuin://register-token/(atapi_[0-9A-F]+)$": async (params: string[]) => {
      const [token] = params;

      try {
        // Hit the "me" endpoint to verify the token and fetch username
        let user = await me(token);

        useStore.getState().setProposedDesktopConnectuser({ username: user.user.username, token });
      } catch (err) {
        if (err instanceof HttpResponseError) {
          console.error("Failed to verify token:", err.code);
        } else {
          console.error("Failed to verify token:", err);
        }
      }
    },
  };

  // If no URL provided, return early
  if (!url) {
    return null;
  }

  // Try to match the URL against each route pattern
  for (const [pattern, handler] of Object.entries(routes)) {
    const regex = new RegExp(pattern, "i");
    const match = url.match(regex);

    if (match) {
      // Extract the captured groups (excluding the full match)
      const params = match.slice(1);

      try {
        return handler(params);
      } catch (error) {
        console.error(`Error handling route for URL ${url}:`, error);
        return null;
      }
    }
  }

  // No matching route found
  console.warn(`No matching route found for URL: ${url}`);
  return null;
};

export default handleDeepLink;
