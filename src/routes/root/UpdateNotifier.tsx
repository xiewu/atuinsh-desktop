import icon from "@/assets/icon.svg";
import { useEffect, useState } from "react";
import {
  addToast,
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  Progress,
} from "@heroui/react";
import { useStore } from "@/state/store";
import { relaunch } from "@tauri-apps/plugin-process";
import { None, Option, Some } from "@/lib/utils";
import AtuinEnv from "@/atuin_env";

export default function UpdateNotifier() {
  const [relaunching, setRelaunching] = useState(false);
  const [showingUpdate, setShowingUpdate] = useState(false);
  const showedUpdatePrompt = useStore((state) => state.showedUpdatePrompt);
  const setShowedUpdatePrompt = useStore((state) => state.setShowedUpdatePrompt);
  const [contentLength, setContentLength] = useState<Option<number>>(None);
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const progress = contentLength
    .map((length) => {
      return Math.floor((downloadedBytes / length) * 100);
    })
    .unwrapOr(0);

  const availableUpdate = useStore((state) => state.availableUpdate);
  const updating = useStore((state) => state.updating);
  const setUpdating = useStore((state) => state.setUpdating);

  async function doUpdate() {
    if (AtuinEnv.isDev) {
      console.log("UpdateNotifier: doUpdate: skipping update in dev mode");
      return;
    }

    setUpdating(true);
    await availableUpdate?.downloadAndInstall((progress) => {
      switch (progress.event) {
        case "Started":
          if (progress.data.contentLength) {
            setContentLength(Some(progress.data.contentLength));
          }
          break;
        case "Progress":
          setDownloadedBytes((n) => n + progress.data.chunkLength);
          break;
      }
    });
    setRelaunching(true);
    setTimeout(() => {
      relaunch();
    }, 3000);
  }

  useEffect(() => {
    if (showingUpdate) {
      setShowedUpdatePrompt(true);
      return;
    }

    if (availableUpdate && !updating && !showedUpdatePrompt) {
      setShowingUpdate(true);
      setShowedUpdatePrompt(true);
      addToast({
        title: "Update Available",
        icon: <img src={icon} alt="icon" className="h-8 w-8" />,
        description: `Atuin Desktop version ${availableUpdate.version} is available for download.`,
        color: "primary",
        radius: "sm",
        timeout: Infinity,
        shouldShowTimeoutProgress: false,
        onClose: () => {
          setShowingUpdate(false);
        },
        endContent: (
          <Button
            size="sm"
            variant="flat"
            color="primary"
            className="p-2"
            onPress={() => doUpdate()}
          >
            Update
          </Button>
        ),
      });
    }
  }, [availableUpdate, updating, showedUpdatePrompt, showingUpdate]);

  if (availableUpdate && updating) {
    return (
      <Modal isOpen={true} onClose={() => {}} hideCloseButton>
        <ModalContent>
          {!relaunching && (
            <ModalHeader>Updating to Atuin Desktop {availableUpdate.version}...</ModalHeader>
          )}
          {relaunching && <ModalHeader>Relaunching app...</ModalHeader>}
          <ModalBody>
            <div className="pb-4">
              <Progress
                value={progress}
                isIndeterminate={contentLength.isNone()}
                disableAnimation={contentLength.isNone()}
              />
            </div>
          </ModalBody>
        </ModalContent>
      </Modal>
    );
  }

  return null;
}
