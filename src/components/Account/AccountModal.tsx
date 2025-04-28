import { Modal, ModalContent, Button, Card, CardBody } from "@heroui/react";
import { open } from "@tauri-apps/plugin-shell";
import * as api from "@/api/api";
import { ask } from "@tauri-apps/plugin-dialog";
import { relaunch } from "@tauri-apps/plugin-process";
import { KVStore } from "@/state/kv";

const completeOnboarding = async () => {
  let db = await KVStore.open_default();
  await db.set("onboarding_complete", true);
};

const AccountModal = ({close, isOpen, restartNeeded}: {close: () => void, isOpen: boolean, restartNeeded: boolean}) => {
  const handleClose = async () => {
    close();
    await completeOnboarding();

    if (restartNeeded) {
      const yes = await ask(
        "To apply your changes, Atuin needs to restart. This won't take long!",
        {
          title: "Restart now?",
          kind: "info",
          okLabel: "Restart now",
          cancelLabel: "I'll do it later",
        },
      );
      if (yes) relaunch();
    }
  }

  return (
    <Modal
      disableAnimation
      isDismissable={false}
      hideCloseButton
      isOpen={isOpen}
      className="select-none"
      size="xl"
    >
      <ModalContent>
        {() => (
          <div className="p-4 space-y-4">
            <h1 className="text-3xl font-bold text-center">Create your Atuin Hub Account</h1>
            <Card>
              <CardBody >
                <h2 className="text-xl font-semibold mb-2">Why sign up?</h2>
                <ul className="text-gray-700 space-y-1 list-disc pl-4 pt-2">
                  <li>Sync your runbooks across devices</li>
                  <li>Share and collaborate with others</li>
                  <li>Back up your work securely to the cloud</li>
                </ul>
              </CardBody>
            </Card>
            <div>
              <Button
                color="primary"
                className="w-full text-lg font-semibold"
                onPress={() => {
                  handleClose();
                  open(`${api.endpoint()}/settings/desktop-connect`);
                }}
              >
                Connect with Hub
              </Button>
              <Button
                color="default"
                variant="flat"
                className="w-full text-lg font-semibold opacity-60"
                onPress={() => {
                  handleClose();
                }}
              >
                Use offline
              </Button>
            </div>
          </div>
        )}
      </ModalContent>
    </Modal>
  );
};

export default AccountModal; 