import { useStore } from "@/state/store";
import { ConnectionState } from "@/state/store/user_state";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  Button,
  ModalFooter,
  Textarea,
  Input,
} from "@heroui/react";
import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FeedbackModal(props: FeedbackModalProps) {
  const connectionState = useStore((state) => state.connectionState);
  const [feedback, setFeedback] = useState("");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  function handleSendFeedback() {
    setSent(true);
    invoke("send_feedback", { feedback, email });
  }

  function handleClose() {
    props.onClose();
    if (sent) {
      setSent(false);
      setFeedback("");
      setEmail("");
    }
  }

  return (
    <Modal isOpen={props.isOpen} onClose={handleClose}>
      <ModalContent>
        <ModalHeader>Share your feedback with us</ModalHeader>
        <ModalBody>
          {sent && <p>Thank you for sharing your feedback with us!</p>}
          {!sent && (
            <form className="flex flex-col gap-2 items-center">
              <Textarea
                placeholder="What would you like to share with us?"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
              />
              <Input
                placeholder="Email (optional)"
                value={email}
                onValueChange={(value) => setEmail(value)}
              />
            </form>
          )}
        </ModalBody>
        <ModalFooter>
          <Button onPress={handleClose} variant="flat">
            {sent ? "Close" : "Cancel"}
          </Button>
          <Button
            type="submit"
            color="primary"
            isDisabled={feedback.length === 0 || connectionState !== ConnectionState.Online || sent}
            onPress={handleSendFeedback}
          >
            Send Feedback
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
