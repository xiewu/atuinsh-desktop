import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  useDisclosure,
  Input,
} from "@nextui-org/react";
import { SettingsIcon } from "lucide-react";
import { useState } from "react";

export interface PrometheusConfig {
  endpoint: string;
}

export default function PromSettings({ config, onSave }: any) {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  const [endpoint, setEndpoint] = useState<string>(config.endpoint);

  return (
    <>
      <Button variant="flat" onPress={onOpen} isIconOnly>
        <SettingsIcon />
      </Button>
      <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="2xl">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                Prometheus Settings
              </ModalHeader>
              <ModalBody>
                <div>
                  <Input
                    value={endpoint}
                    onValueChange={setEndpoint}
                    label="Prometheus Endpoint"
                    description="The URL of the Prometheus server"
                  />
                </div>
              </ModalBody>
              <ModalFooter>
                <Button
                  variant="flat"
                  color="primary"
                  onPress={() => {
                    onSave({ endpoint });
                    onClose();
                  }}
                >
                  Save
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
