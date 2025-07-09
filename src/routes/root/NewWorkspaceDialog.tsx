import { useState } from "react";
import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";

interface NewWorkspaceDialogProps {
  onAccept: (name: string, online: boolean) => void;
  onCancel: () => void;
  forceOnline: boolean;
}

export default function NewWorkspaceDialog({
  onAccept,
  onCancel,
  forceOnline,
}: NewWorkspaceDialogProps) {
  const [name, setName] = useState("New Workspace");
  const [isOnline, setIsOnline] = useState(true);

  function closeAndReset() {
    onCancel();
    setName("New Workspace");
    setIsOnline(true);
  }

  function handleSubmit() {
    onAccept(name, isOnline);
  }

  return (
    <Modal isOpen={true} onClose={closeAndReset}>
      <ModalContent>
        <ModalHeader>Create New Workspace</ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <Input
              label="Workspace Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />

            <div>
              <label className="block text-sm font-medium mb-2">Workspace Type</label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={isOnline}
                    onChange={() => setIsOnline(true)}
                    className="mr-2"
                    disabled={forceOnline}
                  />
                  <span>Online - Sync across devices</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={!isOnline}
                    onChange={() => setIsOnline(false)}
                    className="mr-2"
                    disabled={forceOnline}
                  />
                  <span>Offline - Local only</span>
                </label>
              </div>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button onPress={closeAndReset} variant="flat">
            Cancel
          </Button>
          <Button onPress={handleSubmit} color="primary">
            Create Workspace
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
