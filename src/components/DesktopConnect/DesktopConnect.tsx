import { useStore } from "@/state/store";
import {
  Modal,
  ModalContent,
  Button,
  useDisclosure,
  Card,
  CardBody,
} from "@nextui-org/react";
import { invoke } from "@tauri-apps/api/core";

import { useEffect, useMemo } from "react";

const DesktopConnect = () => {
  let {
    isOpen: isOnboardingOpen,
    onOpen: onOnboardingOpen,
    onOpenChange: onOnboardingOpenChange,
  } = useDisclosure();

  let setDesktopConnect = useStore((state) => state.setDesktopConnect);

  useEffect(() => {
    onOnboardingOpen();
  }, []);

  const close = async (onClose: any) => {
    let proposedUsername = localStorage.getItem("proposedUsername");
    let proposedToken = localStorage.getItem("proposedToken");

    localStorage.removeItem("proposedUsername");
    localStorage.removeItem("proposedToken");

    await invoke("save_password", {
      service: "sh.atuin.runbooks.api",
      user: proposedUsername,
      value: proposedToken,
    });

    setDesktopConnect(false);
    onClose();
  };

  let username = useMemo(() => {
    let proposedUsername = localStorage.getItem("proposedUsername");
    return proposedUsername;
  }, []);

  return (
    <Modal
      disableAnimation
      isDismissable={false}
      hideCloseButton
      isOpen={isOnboardingOpen}
      onOpenChange={onOnboardingOpenChange}
      className="w-full select-none"
      size="2xl"
    >
      <ModalContent className="w-full">
        {(onClose) => (
          <div className="max-w-[900px] mx-auto p-6 space-y-6">
            <h1 className="text-4xl text-center">Atuin Hub Connection</h1>
            <Card>
              <CardBody className="gap-4">
                <h2 className="text-xl">Connection request from Atuin Hub</h2>
                <h3 className="text-l">Username: {username}</h3>
                <p className="text-gray-600">
                  Atuin Hub is requesting to connect to your Atuin Desktop
                  instance. This will allow you to browse and share Runbooks
                  with other users, and keep them backed up.
                </p>
                <p className="text-gray-600">
                  We store all secrets securely in your keychain, which you will
                  be prompted to provide access to
                </p>
                c
              </CardBody>
            </Card>

            <div className="flex justify-end gap-2">
              <Button variant="flat" color="danger" onClick={onClose}>
                Cancel
              </Button>

              <Button
                variant="flat"
                color="success"
                onClick={() => close(onClose)}
              >
                Accept
              </Button>
            </div>
          </div>
        )}
      </ModalContent>
    </Modal>
  );
};

export default DesktopConnect;
