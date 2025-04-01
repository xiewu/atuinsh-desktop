import { useStore } from "@/state/store";
import { DialogRequest } from "@/state/store/dialog_state";
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/react";
import {
  CheckCircleIcon,
  CircleAlertIcon,
  CircleHelpIcon,
  InfoIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useEffect, useMemo, useReducer } from "react";

type Action =
  | { type: "reset"; dialog: DialogRequest<any> | null }
  | {
      type: "first_click";
      index: number;
    };

type State = {
  dialog: DialogRequest<any> | null;
  confirming: boolean[];
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "reset":
      return {
        dialog: action.dialog,
        confirming: action.dialog?.actions.map(() => false) || [],
      };
    case "first_click":
      return {
        ...state,
        confirming: state.confirming.map((value, index) => (index === action.index ? true : value)),
      };
  }
}

export default function DialogManager() {
  const queue = useStore((state) => state.dialogQueue);
  const nextDialog = useMemo(() => (queue.length > 0 ? queue[0] : null), [queue]);
  const popDialog = useStore((state) => state.popDialog);

  const [confirmState, dispatch] = useReducer(
    reducer,
    nextDialog,
    (dialog: DialogRequest<any> | null) => {
      return {
        dialog,
        confirming: dialog?.actions.map(() => false) || [],
      };
    },
  );

  useEffect(() => {
    if (nextDialog) {
      dispatch({ type: "reset", dialog: nextDialog });
    }
  }, [nextDialog]);

  if (!nextDialog) {
    return null;
  }

  let Icon = null;
  if (nextDialog.icon === "warning") {
    Icon = TriangleAlertIcon;
  } else if (nextDialog.icon === "info") {
    Icon = InfoIcon;
  } else if (nextDialog.icon === "error") {
    Icon = CircleAlertIcon;
  } else if (nextDialog.icon === "success") {
    Icon = CheckCircleIcon;
  } else if (nextDialog.icon === "question") {
    Icon = CircleHelpIcon;
  }

  return (
    <Modal
      isOpen={true}
      key={nextDialog.id}
      isDismissable={false}
      hideCloseButton={true}
      classNames={{ wrapper: "!z-[100001]", base: "!z-[100001]" }}
    >
      <ModalContent>
        <ModalHeader className="bg-gray-200 dark:bg-gray-800 py-3">{nextDialog.title}</ModalHeader>
        <ModalBody className="py-4 flex flex-row gap-4">
          <div>{Icon && <Icon className="w-12 h-12 stroke-gray-500 dark:stroke-gray-400" />}</div>
          {typeof nextDialog.message === "string" ? (
            <p>{nextDialog.message}</p>
          ) : (
            nextDialog.message
          )}
        </ModalBody>
        <ModalFooter>
          {nextDialog.actions.map((action, index) => (
            <Button
              key={index}
              variant={action.variant}
              color={action.color}
              onPress={() => {
                if (action.confirmWith && !confirmState.confirming[index]) {
                  dispatch({ type: "first_click", index });
                } else {
                  nextDialog.resolve(action.value);
                  popDialog();
                }
              }}
            >
              {confirmState.confirming[index] ? action.confirmWith : action.label}
            </Button>
          ))}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
