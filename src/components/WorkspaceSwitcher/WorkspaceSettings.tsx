import { useEffect, useState } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
} from "@nextui-org/react";
import Workspace from "@/state/runbooks/workspace";
import { AtuinState, useStore } from "@/state/store";
import { ask, message } from "@tauri-apps/plugin-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { allWorkspaces } from "@/lib/queries/workspaces";
import { allRunbooks, runbooksByWorkspaceId } from "@/lib/queries/runbooks";

interface WorkspaceSettingsProps {
  isOpen: boolean;
  workspace: Workspace | null;
  workspaceCount: number;
  onClose: () => void;
}

const WorkspaceSettings = ({
  isOpen,
  onClose,
  workspace,
  workspaceCount,
}: WorkspaceSettingsProps) => {
  const [workspaceName, setWorkspaceName] = useState(workspace?.name);
  const currentWorkspaceId = useStore((store: AtuinState) => store.currentWorkspaceId);
  const queryClient = useQueryClient();

  useEffect(() => {
    setWorkspaceName(workspace?.name);
  }, [workspace]);

  const handleSave = async () => {
    if (!workspaceName) return;

    await workspace?.rename(workspaceName);
    queryClient.invalidateQueries(allWorkspaces());
    onClose();
  };

  if (workspace === null) {
    return <div />;
  }

  const handleDelete = async () => {
    if (workspace.id === currentWorkspaceId) {
      await message(
        "You cannot delete a workspace while it is in use. Select another and try again.",
        "Error",
      );
      return;
    }

    if (workspaceCount === 1) {
      await message("You cannot delete the last workspace.", "Error");
      return;
    }

    const yes = await ask(`Are you sure you want to delete the workspace "${workspace.name}"?`, {
      title: "Confirmation",
      okLabel: "Delete",
      cancelLabel: "Cancel",
    });

    if (yes) {
      const { id } = workspace;
      await workspace.delete();
      queryClient.invalidateQueries(allWorkspaces());
      queryClient.invalidateQueries(allRunbooks());
      queryClient.invalidateQueries(runbooksByWorkspaceId(id));
    }

    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} placement="center">
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">Workspace Settings</ModalHeader>

            <ModalBody>
              <h2 className="text-xl font-semibold">General</h2>
              <Input
                label="Workspace Name"
                placeholder="Enter workspace name"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
              />

              <h2 className="text-xl font-semibold">Danger</h2>
              <Button color="danger" variant="flat" onPress={handleDelete}>
                Delete workspace
              </Button>
            </ModalBody>

            <ModalFooter>
              <Button color="default" variant="flat" onPress={onClose}>
                Cancel
              </Button>
              <Button color="success" variant="flat" onPress={handleSave}>
                Save Changes
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};

export default WorkspaceSettings;
