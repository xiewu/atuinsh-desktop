import { createContext } from "react";

function stub() {
  throw new Error("context not initialized");
}

interface API {
  activateRunbook: (runbookId: string | null) => void;
  promptDeleteRunbook: (runbookId: string) => void;
  runbookDeleted: (workspaceId: string, runbookId: string) => void;
  promptMoveRunbookWorkspace: (
    oldWorkspaceId: string,
    newWorkspaceId: string,
    runbookId: string,
    newParentFolderId: string,
  ) => void;
  runbookCreated: (runbookId: string, workspaceId: string, parentFolderId: string | null) => void;
}

const RunbookContext = createContext<API>({
  activateRunbook: stub,
  promptDeleteRunbook: stub,
  promptMoveRunbookWorkspace: stub,
  runbookCreated: stub,
  runbookDeleted: stub,
});

export default RunbookContext;
