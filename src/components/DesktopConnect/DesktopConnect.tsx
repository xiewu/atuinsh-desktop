import { useStore } from "@/state/store";
import { Modal, ModalContent, Button, Card, CardBody } from "@heroui/react";
import { setHubApiToken } from "@/api/api";
import SocketManager from "@/socket";

const DesktopConnect = () => {
  let setProposedDesktopConnectUser = useStore((state) => state.setProposedDesktopConnectuser);
  let proposedUser = useStore((state) => state.proposedDesktopConnectUser);

  const confirm = async () => {
    if (proposedUser) {
      await setHubApiToken(proposedUser.username, proposedUser.token);
      SocketManager.setApiToken(proposedUser.token);
      useStore.getState().refreshUser();
    }

    setProposedDesktopConnectUser(undefined);
  };

  const cancel = async () => {
    setProposedDesktopConnectUser(undefined);
  };

  return (
    <Modal
      disableAnimation
      isDismissable={false}
      hideCloseButton
      isOpen={true}
      className="w-full select-none"
      size="2xl"
    >
      <ModalContent className="w-full">
        {(_onClose) => (
          <div className="max-w-[900px] mx-auto p-6 space-y-6">
            <h1 className="text-4xl text-center">Atuin Hub Connection</h1>
            <Card>
              <CardBody className="gap-4">
                <h2 className="text-xl">Connection request from Atuin Hub</h2>
                <h3 className="text-l">Username: {proposedUser!.username}</h3>
                <p className="text-gray-600">
                  Atuin Hub is requesting to connect to your Atuin Desktop instance. This will allow
                  you to browse and share Runbooks with other users, and keep them backed up.
                </p>
                <p className="text-gray-600">
                  We store all secrets securely in your keychain, which you will be prompted to
                  provide access to.
                </p>
              </CardBody>
            </Card>

            <div className="flex justify-end gap-2">
              <Button variant="flat" color="default" onClick={cancel}>
                Cancel
              </Button>

              <Button variant="flat" color="success" onClick={confirm}>
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
