import { RemoteRunbook } from "@/state/models";
import Runbook from "@/state/runbooks/runbook";
import { useStore } from "@/state/store";
import * as api from "@/api/api";
import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Spinner,
} from "@heroui/react";
import { useContext, useEffect, useMemo, useReducer } from "react";
import { None, Option, Some, usernameFromNwo } from "@/lib/utils";
import { ConnectionState } from "@/state/store/user_state";
import RunbookContext from "@/context/runbook_context";

interface DeleteRunbookModalProps {
  runbookId: string;
  onClose: () => void;
  onRunbookDeleted: (workspaceId: string, runbookId: string) => void;
}

type Ownership = "local" | "none" | "owner" | "collaborator";

type DeleteState = {
  runbook: Runbook | null;
  remoteRunbook: Option<RemoteRunbook> | null;
  isMissingFromRemote: boolean;
  isDeleting: boolean;
};

type Action =
  | {
      type: "set_runbook";
      runbook: Runbook | null;
    }
  | {
      type: "set_remote_runbook";
      remoteRunbook: Option<RemoteRunbook> | null;
    }
  | {
      type: "set_deleting";
      isDeleting: boolean;
    }
  | {
      type: "set_missing";
      isMissingFromRemote: boolean;
    };

function reducer(state: DeleteState, action: Action): DeleteState {
  switch (action.type) {
    case "set_deleting":
      return { ...state, isDeleting: true };
    case "set_remote_runbook":
      return { ...state, remoteRunbook: action.remoteRunbook };
    case "set_runbook":
      return { ...state, runbook: action.runbook };
    case "set_missing":
      return { ...state, isMissingFromRemote: action.isMissingFromRemote };
  }
}

const INITIAL_STATE: DeleteState = {
  runbook: null,
  remoteRunbook: null,
  isDeleting: false,
  isMissingFromRemote: false,
};

export default function DeleteRunbookModal(props: DeleteRunbookModalProps) {
  const { runbookId, onClose } = props;

  const user = useStore((store) => store.user);
  const connectionState = useStore((store) => store.connectionState);
  const currentRunbookId = useStore((store) => store.currentRunbookId);
  const refreshRunbooks = useStore((store) => store.refreshRunbooks);
  const { activateRunbook } = useContext(RunbookContext);

  const [deleteState, dispatch] = useReducer(reducer, INITIAL_STATE);

  const ownership: Ownership | null = useMemo(() => {
    const { runbook, remoteRunbook } = deleteState;
    if (!runbook || !remoteRunbook) return null;

    if (remoteRunbook.isNone()) {
      return "local";
    }

    const remote = remoteRunbook.unwrap();
    const isOwner = usernameFromNwo(remote.nwo) === user.username;
    const isCollaborator = !isOwner && remote.permissions.includes("update_content");

    if (isOwner) return "owner";
    else if (isCollaborator) return "collaborator";
    else return "none";
  }, [deleteState]);

  useEffect(() => {
    Runbook.load(runbookId).then((runbook) => dispatch({ type: "set_runbook", runbook: runbook }));

    return () => {
      dispatch({ type: "set_runbook", runbook: null });
      dispatch({ type: "set_remote_runbook", remoteRunbook: null });
    };
  }, [runbookId]);

  useEffect(() => {
    (async () => {
      if (!deleteState.runbook) {
        dispatch({ type: "set_remote_runbook", remoteRunbook: null });
        return;
      }

      let remoteRunbook: RemoteRunbook | null = null;
      try {
        remoteRunbook = await api.getRunbookID(runbookId);
      } catch (err) {
        if (err instanceof api.HttpResponseError && err.code === 404) {
          // No runbook exists on the remote
          dispatch({ type: "set_missing", isMissingFromRemote: true });
        } else {
          const remoteData = deleteState.runbook.remoteInfo;
          if (remoteData) remoteRunbook = JSON.parse(remoteData) as RemoteRunbook;
        }
      }

      if (!remoteRunbook) {
        dispatch({ type: "set_remote_runbook", remoteRunbook: None });
      } else {
        dispatch({ type: "set_remote_runbook", remoteRunbook: Some(remoteRunbook) });
      }
    })();

    return () => {
      dispatch({ type: "set_remote_runbook", remoteRunbook: null });
    };
  }, [deleteState.runbook]);

  async function confirmDeleteRunbook() {
    dispatch({ type: "set_deleting", isDeleting: true });
    try {
      await doDeleteRunbook();
      onClose();
    } catch (err) {
      dispatch({ type: "set_deleting", isDeleting: false });
      alert("There was a problem deleting the runbook");
    }
  }

  async function doDeleteRunbook() {
    const { runbook, remoteRunbook } = deleteState;
    if (!runbook || !remoteRunbook) return;

    if (runbook.id === currentRunbookId) activateRunbook(null);
    const id = runbook.id;
    const workspaceId = runbook.workspaceId;
    await runbook.delete();
    props.onRunbookDeleted(workspaceId, id);
    refreshRunbooks();
  }

  function renderModalContent() {
    const { runbook, remoteRunbook, isMissingFromRemote } = deleteState;
    if (!runbook || (!remoteRunbook && !isMissingFromRemote)) {
      return <Spinner />;
    } else {
      const nwo = remoteRunbook ? remoteRunbook.map((rrb) => rrb.nwo) : None;
      return (
        <>
          <p>
            Are you sure you want to delete <strong>{deleteState.runbook?.name}</strong>?
          </p>
          {ownership === "local" && (
            <p>
              This runbook is not backed up to Atuin Hub, so the contents of the runbook will be
              permanently lost when it is deleted.
            </p>
          )}
          {ownership === "none" && (
            <p>
              Once this runbook is deleted, you will only be able to access it again via Atuin Hub
              at {nwo.unwrap()}.
            </p>
          )}
          {ownership === "owner" && (
            <>
              <p>Deleting this runbook will:</p>
              <ul className="list-disc ml-4">
                <li>Permanently delete this runbook from your machine</li>
                <li>Permanently delete this runbook from Atuin Hub ({nwo.unwrap()})</li>
              </ul>
              {connectionState !== ConnectionState.Offline && (
                <p>
                  Since you are offline, this operation will be performed the next time you are
                  online.
                </p>
              )}
            </>
          )}
          {ownership === "collaborator" && (
            <>
              <p>Deleting this runbook will:</p>
              <ul className="list-disc ml-4">
                <li>Permanently delete this runbook from your machine</li>
                <li>
                  Permanently remove your collaboration with the runbook on Atuin Hub (
                  {nwo.unwrap()})
                </li>
              </ul>
              {connectionState !== ConnectionState.Offline && (
                <p>
                  Since you are offline, this operation will be performed the next time you are
                  online.
                </p>
              )}
            </>
          )}
        </>
      );
    }
  }

  return (
    <Modal isOpen size="2xl" onClose={onClose}>
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader>Delete Runbook</ModalHeader>
            <ModalBody>{renderModalContent()}</ModalBody>
            <ModalFooter>
              <Button
                color="danger"
                onClick={confirmDeleteRunbook}
                disabled={deleteState.isDeleting}
              >
                Delete
              </Button>
              <Button onClick={onClose} disabled={deleteState.isDeleting}>
                Cancel
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
