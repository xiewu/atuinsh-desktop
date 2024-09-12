import {
  Modal,
  ModalContent,
  Button,
  useDisclosure,
  Card,
  CardBody,
} from "@nextui-org/react";

import { useEffect, useState } from "react";
import { installAtuinCLI } from "@/lib/utils";
import cliDemo from "@/assets/cli_demo.mp4";

const InstallCLI = () => {
  let {
    isOpen: isInstallCLIOpen,
    onOpen: onInstallCLIOpen,
    onOpenChange: onInstallCLIOpenChange,
  } = useDisclosure();

  const [installing, setInstalling] = useState<boolean>(false);

  useEffect(() => {
    onInstallCLIOpen();
  }, []);

  return (
    <Modal
      isDismissable={true}
      isOpen={isInstallCLIOpen}
      onOpenChange={onInstallCLIOpenChange}
      className="w-full select-none"
      size="2xl"
    >
      <ModalContent className="w-full">
        {(onClose) => (
          <div className="max-w-[900px] mx-auto p-6 space-y-6">
            <h1 className="text-4xl font-bold text-center">
              Install the Atuin CLI for full history functionality
            </h1>

            <h3 className="text-xl font-semibold text-center">
              Search, sync, and explore your shell history
            </h3>

            <div style={{ position: "relative", paddingTop: "56.25%" }}>
              <iframe
                src="https://iframe.mediadelivery.net/embed/207337/2e21ead8-7c95-4ee8-b3a4-ffa5efaaecca?autoplay=true&loop=true&muted=true&preload=true&responsive=true"
                loading="lazy"
                style={{
                  border: 0,
                  position: "absolute",
                  top: 0,
                  height: "100%",
                  width: "100%",
                }}
                allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;"
                allowfullscreen="true"
              ></iframe>
            </div>

            <Card>
              <CardBody>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Not required for Runbook functionality</li>
                  <li>
                    MIT licensed, open source CLI with {">"}20,000 GitHub stars
                  </li>
                  <li>Single binary install</li>
                  <li>Optional, e2e encrypted shell history sync and backup</li>
                </ul>
              </CardBody>
            </Card>

            <Button
              isLoading={installing}
              color="success"
              className="w-full"
              onPress={async () => {
                setInstalling(true);
                await installAtuinCLI();
                setInstalling(false);
                onClose();
              }}
            >
              Install CLI
            </Button>
          </div>
        )}
      </ModalContent>
    </Modal>
  );
};

export default InstallCLI;
