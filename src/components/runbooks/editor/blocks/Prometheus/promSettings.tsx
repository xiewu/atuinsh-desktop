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

export default function PromSettings({ promEndpoint, setPromEndpoint }: any) {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  return (
    <>
      <Button variant="flat" onPress={onOpen} isIconOnly>
        <SettingsIcon />
      </Button>
      <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="2xl">
        <ModalContent>
          {(_onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                Prometheus Settings
              </ModalHeader>
              <ModalBody>
                <div>
                  <Input
                    value={promEndpoint}
                    onValueChange={setPromEndpoint}
                    placeholder="http://localhost:9090"
                    label="Prometheus Endpoint"
                    description="The URL of the Prometheus server"
                  />
                </div>
              </ModalBody>
              <ModalFooter></ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
