import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  Button,
} from "@nextui-org/react";
import { Icon } from "@iconify/react";
import GeneralSettings from "./GeneralSettings";

export default function Settings({ isOpen, onOpenChange }: any) {
  return (
    <>
      <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="4xl">
        <ModalContent>
          {(_) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <div className="w-full max-w-2xl flex-1 p-4">
                  {/* Title */}
                  <div className="flex items-center gap-x-3">
                    <Button
                      isIconOnly
                      className="sm:hidden"
                      size="sm"
                      variant="flat"
                      onPress={onOpenChange}
                    >
                      <Icon
                        className="text-default-500"
                        icon="solar:sidebar-minimalistic-linear"
                        width={20}
                      />
                    </Button>
                    <h1 className="text-3xl font-bold leading-9 text-default-foreground">
                      Settings
                    </h1>
                  </div>
                  <h2 className="mt-2 text-small text-default-500">
                    Customize settings
                  </h2>
                </div>
              </ModalHeader>
              <ModalBody>
                {/*  Tabs
                <Tabs
                  fullWidth
                  classNames={{
                    cursor: "bg-content1 dark:bg-content1",
                    panel: "w-full p-0 ",
                  }}
                  >*/}
                <GeneralSettings />
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
