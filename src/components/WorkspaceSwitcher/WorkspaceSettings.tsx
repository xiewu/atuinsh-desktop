import { useState } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Input } from "@nextui-org/react";
import Workspace from '@/state/runbooks/workspace';
import { AtuinState, useStore } from '@/state/store';

interface WorkspaceSettingsProps {
  isOpen: boolean;
  workspace: Workspace | null;
  onClose: () => void;
}

const WorkspaceSettings = ({ isOpen, onClose, workspace }: WorkspaceSettingsProps) => {
  const [workspaceName, setWorkspaceName] = useState(workspace?.name);
  const refreshWorkspaces = useStore((store: AtuinState) => store.refreshWorkspaces);

  const handleSave = () => {
    if (!workspaceName) return;
    workspace?.rename(workspaceName);
    refreshWorkspaces();
    onClose();
  };

  if (workspace === null) {
    console.log('workspace not found');
    return <div />;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      placement="center"
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">Workspace Settings</ModalHeader>
            <ModalBody>
              <Input
                label="Workspace Name"
                placeholder="Enter workspace name"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
              />
            </ModalBody>
            <ModalFooter>
              <Button color="danger" variant="light" onPress={onClose}>
                Cancel
              </Button>
              <Button color="primary" onPress={handleSave}>
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
