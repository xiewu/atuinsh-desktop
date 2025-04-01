import Runbook, { RunbookVisibility } from "@/state/runbooks/runbook";
import { Button, Popover, PopoverContent, PopoverTrigger } from "@heroui/react";
import { useEffect, useState } from "react";
import { useStore } from "@/state/store";
import * as api from "@/api/api";
import { CloudOffIcon, ShareIcon, TriangleAlertIcon, WifiOffIcon } from "lucide-react";
import Publish from "./sharing/Publish";
import LoggedOut from "./sharing/LoggedOut";
import Offline from "./sharing/Offline";
import NoPermission from "./sharing/NoPermission";
import { RemoteRunbook } from "@/state/models";
import ServerNotificationManager from "@/server_notification_manager";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { slugify, useDebounce } from "@/lib/utils";
import { DialogBuilder } from "@/components/Dialogs/dialog";
import Snapshot from "@/state/runbooks/snapshot";
import Logger from "@/lib/logger";
import OutOfDate from "./sharing/OutOfDate";
import { ConnectionState } from "@/state/store/user_state";
const logger = new Logger("SharePopover", "purple", "purple");

type ShareProps = {
  runbook: Runbook;
  remoteRunbook?: RemoteRunbook;
  refreshRemoteRunbook: () => void;
  onShareToHub: () => void;
  onDeleteFromHub: () => void;
};

type ShareRunbookMutationArgs = { runbook: Runbook; slug: string; visibility: RunbookVisibility };

const slugRegex = /^[a-z0-9\-_]+$/i;

export default function Share({
  runbook,
  remoteRunbook,
  onShareToHub,
  onDeleteFromHub,
}: ShareProps) {
  const [slug, setSlug] = useState<string>(slugify(runbook.name));
  const [visibility, setVisibility] = useState<RunbookVisibility>("private");
  const [error, setError] = useState<string | undefined>(undefined);
  const [slugDebounced, resetDebounced, _clearDebounced] = useDebounce(500, true);
  const [changedSinceValidate, setChangedSinceValidate] = useState(false);
  const [userChangedSlug, setUserChangedSlug] = useState(false);

  const connectionState = useStore((state) => state.connectionState);
  const currentVersion = useStore((state) => state.currentVersion);
  const minimumVersion = useStore((state) => state.minimumVersion);
  const canUpdate = remoteRunbook?.permissions.includes("update");

  const queryClient = useQueryClient();

  const shareRunbook = useMutation({
    mutationFn: ({ runbook, slug, visibility }: ShareRunbookMutationArgs) => {
      return api.createRunbook(runbook, slug, visibility);
    },
    onSuccess: async (_data, vars) => {
      setError(undefined);
      queryClient.invalidateQueries({ queryKey: ["remote_runbook", vars.runbook.id] });

      // Now that the server can map the client ID to a server ID,
      // we can subscribe to changes in this runbook.
      ServerNotificationManager.get().subscribe(vars.runbook.id);
      onShareToHub();

      // Update remote info immediately after sharing;
      // this is necessary to get the sidebar list to update icon colors.
      try {
        const remoteRb = await api.getRunbookID(vars.runbook.id);
        if (remoteRb) {
          vars.runbook.remoteInfo = JSON.stringify(remoteRb);
          await vars.runbook.save();
        }
      } catch (err: any) {}
    },
    onError: (err: any) => {
      if (err instanceof api.HttpResponseError) handleHttpError(err);
      else {
        setError("An unknown error occurred");
        logger.error(err);
      }
    },
    scope: { id: `runbook` },
  });

  const shareSnapshot = useMutation({
    mutationFn: async (snapshot: Snapshot) => {
      return api.createSnapshot(snapshot);
    },
    onSuccess: (_data, snapshot) => {
      logger.info(`Successfully created snapshot ${snapshot.tag} in the background`);
    },
    onError: (err: any) => {
      logger.error("ERROR CREATING SNAPSHOT IN BACKGROUND", err);
    },
    scope: { id: `runbook` },
  });

  const editRunbook = useMutation({
    mutationFn: ({ runbook, slug, visibility }: ShareRunbookMutationArgs) => {
      return api.updateRunbook(runbook, slug, visibility);
    },
    onSuccess: (_data, vars) => {
      setError(undefined);
      queryClient.invalidateQueries({ queryKey: ["remote_runbook", vars.runbook.id] });
    },
    onError: (err: any) => {
      if (err instanceof api.HttpResponseError) handleHttpError(err);
      else setError("An unknown error occurred");
    },
    scope: { id: "runbook" },
  });

  const deleteRunbook = useMutation({
    mutationFn: (id: string) => api.deleteRunbook(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["remote_runbook", id] });
      onDeleteFromHub();
    },
    scope: { id: "runbook" },
  });

  useEffect(() => {
    if (remoteRunbook && !userChangedSlug) {
      setSlug(remoteRunbook.slug);
      setVisibility(remoteRunbook.visibility);
    } else if (runbook && !userChangedSlug) {
      setSlug(slugify(runbook.name));
    }
  }, [runbook, remoteRunbook]);

  function validateSlug(slug: string) {
    setChangedSinceValidate(false);
    if (slug.trim().length < 2) {
      setError("Slug must be at least 2 characters long");
    } else if (!slugRegex.test(slug)) {
      setError("Slug may contain letters, numbers, dashes, and underscores");
    } else {
      setError(undefined);
    }
  }

  useEffect(() => {
    if (slugDebounced) {
      validateSlug(slug);
    }
  }, [slugDebounced]);

  function handleHttpError(err: api.HttpResponseError) {
    const data = err.data as any;
    if (data.errors?.length) {
      setError(data.errors[0]);
    }
  }

  function handleSetSlug(newSlug: string) {
    setUserChangedSlug(true);
    setSlug(newSlug);
    setChangedSinceValidate(true);
    resetDebounced();
  }

  async function handlePublishSubmit() {
    setChangedSinceValidate(false);
    const snapshots = await Snapshot.findByRunbookId(runbook.id);
    shareRunbook.mutate({ runbook, slug, visibility });
    snapshots.forEach((snapshot) => {
      shareSnapshot.mutate(snapshot);
    });
  }

  async function handleEditSubmit() {
    setChangedSinceValidate(false);
    editRunbook.mutate({ runbook, slug, visibility });
  }

  async function handleDelete() {
    if (!remoteRunbook) return;

    const confirm = await new DialogBuilder<"yes" | "no">()
      .title("Delete runbook?")
      .icon("warning")
      .message(
        "Are you sure you want to delete this runbook from Atuin Hub? This action cannot be undone.",
      )
      .action({ label: "Cancel", value: "no", variant: "flat" })
      .action({ label: "Delete", value: "yes", color: "danger" })
      .build();

    if (confirm === "yes") {
      deleteRunbook.mutate(remoteRunbook.id);
    }
  }

  const buttonColor = (() => {
    if (connectionState !== ConnectionState.Online) return "danger";
    else if (connectionState === ConnectionState.Online && (canUpdate || !remoteRunbook))
      return "success";
    else if (connectionState === ConnectionState.Online && !canUpdate) return "warning";
  })();

  const enabled = !shareRunbook.isPending && slugDebounced && (!error || changedSinceValidate);

  return (
    <Popover
      placement="bottom-end"
      containerPadding={0}
      showArrow
      // Set opaque backdrop so that tooltipos don't show through from doc,
      // but then set the bg color to transparent so there's no coloring.
      backdrop="opaque"
      classNames={{
        backdrop: ["bg-transparent"],
        base: ["w-[30rem]"],
        content: ["p-0"],
      }}
    >
      <PopoverTrigger className="">
        <Button
          size="sm"
          variant="flat"
          color={buttonColor}
          className="basis-[100px] min-w-[100px] mt-1 w-full shrink-0"
        >
          {connectionState === ConnectionState.Offline && <WifiOffIcon size={16} />}
          {connectionState === ConnectionState.OutOfDate && <TriangleAlertIcon size={16} />}
          {connectionState === ConnectionState.LoggedOut && <CloudOffIcon size={16} />}
          {connectionState === ConnectionState.Online && canUpdate && <ShareIcon size={16} />}
          {connectionState === ConnectionState.Online && !canUpdate && <ShareIcon size={16} />}
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        {connectionState === ConnectionState.Online && remoteRunbook && canUpdate && (
          <Publish
            mode="edit"
            runbook={runbook}
            remoteRunbook={remoteRunbook}
            slug={slug}
            setSlug={handleSetSlug}
            visibility={visibility}
            setVisibility={setVisibility}
            error={error}
            onPublish={handlePublishSubmit}
            onEdit={handleEditSubmit}
            onDelete={handleDelete}
            isEnabled={enabled}
          />
        )}
        {connectionState === ConnectionState.Online && !remoteRunbook && (
          <Publish
            mode="publish"
            runbook={runbook}
            remoteRunbook={remoteRunbook}
            slug={slug}
            setSlug={handleSetSlug}
            visibility={visibility}
            setVisibility={setVisibility}
            error={error}
            onPublish={handlePublishSubmit}
            onEdit={handleEditSubmit}
            onDelete={handleDelete}
            isEnabled={enabled}
          />
        )}
        {connectionState === ConnectionState.LoggedOut && <LoggedOut />}
        {connectionState === ConnectionState.Online && remoteRunbook && !canUpdate && (
          <NoPermission remoteRunbook={remoteRunbook} />
        )}
        {connectionState === ConnectionState.Offline && <Offline />}
        {connectionState === ConnectionState.OutOfDate && (
          <OutOfDate currentVersion={currentVersion} minimumVersion={minimumVersion.unwrap()} />
        )}
      </PopoverContent>
    </Popover>
  );
}
