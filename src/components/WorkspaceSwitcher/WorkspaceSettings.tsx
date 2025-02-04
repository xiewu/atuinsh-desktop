import { useEffect, useState } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  useDisclosure,
} from "@heroui/react";
import Workspace from "@/state/runbooks/workspace";
import { AtuinState, useStore } from "@/state/store";
import { ask, message } from "@tauri-apps/plugin-dialog";

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

  // Users have to type the name of the workspace to delete it
  const [deleteConfirm, setDeleteConfirm] = useState("");

  // Modal for confirming workspace deletion
  const {isOpen: isDeleteOpen, onOpen: onDeleteOpen, onOpenChange: onDeleteOpenChange} = useDisclosure();

  const currentWorkspaceId = useStore((store: AtuinState) => store.currentWorkspaceId);

  useEffect(() => {
    setWorkspaceName(workspace?.name);
  }, [workspace]);

  const handleSave = async () => {
    if (!workspaceName) return;

    await workspace?.rename(workspaceName);
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
      await workspace.delete();
    }

    setDeleteConfirm("");

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
              <Button color="danger" variant="flat" onPress={onDeleteOpen}>
                Delete workspace
              </Button>


              <Modal isOpen={isDeleteOpen} onOpenChange={onDeleteOpenChange}>
        <ModalContent>
          {(_onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">Delete Workspace</ModalHeader>
              <ModalBody>
                <p>
                  Are you sure you want to delete the workspace "{workspace.name}"? This will delete all runbooks in the workspace.
                </p>
                <Input
                  label="Confirm Workspace Name"
                  placeholder="Enter workspace name"
                  value={deleteConfirm}
                  onValueChange={(val) => setDeleteConfirm(val)}
                  isInvalid={deleteConfirm.toLowerCase() != workspace.name.toLowerCase()}
                  errorMessage={"Please enter the workspace name to confirm deletion"}
                />

                <strong>
                  This action cannot be undone.
                </strong>

                <Button color="danger" variant="flat" onPress={handleDelete}  isDisabled={deleteConfirm.toLowerCase() != workspace.name.toLowerCase()}>Delete workspace</Button>
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>
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
