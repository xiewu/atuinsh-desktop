import Runbook from "@/state/runbooks/runbook";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@nextui-org/react";
import { useEffect, useState } from "react";
import { useStore } from "@/state/store";
import { cn } from "@/lib/utils";
import { endpoint } from "@/api/api";
import { CloudOffIcon, ShareIcon } from "lucide-react";
import Publish from "./sharing/Publish";
import LoggedOut from "./sharing/LoggedOut";
import Offline from "./sharing/Offline";
import useRemoteRunbook from "@/lib/useRemoteRunbook";
import NoPermission from "./sharing/NoPermission";

function slugify(name: string | null): string {
  if (name) {
    return name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9_\-]/gi, "");
  } else {
    return "";
  }
}

type ShareProps = {
  runbook: Runbook;
};

export default function Share({ runbook }: ShareProps) {
  const [slug, setSlug] = useState<string>(slugify(runbook.name));
  const [visibility, setVisibility] = useState<string>("private");
  const [slugAvailable, setSlugAvailable] = useState<boolean>(true);
  const [success, setSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const remoteRunbook = useRemoteRunbook(runbook);

  const online = useStore((state) => state.online);
  const user = useStore((state) => state.user);
  const canUpdate = remoteRunbook?.permissions.includes("update");

  useEffect(() => {
    setSlug(slugify(runbook.name));
  }, [runbook]);

  function shareRunbook(runbook: Runbook, slug: string, visibility: string, arg3: () => void) {
    throw new Error("Function not implemented.");
  }

  const buttonColor = (() => {
    if (online && (canUpdate || !remoteRunbook)) return "success";
    else if (online && !canUpdate) return "warning";
    else if (!online) return "danger";
  })();

  return (
    <Popover
      placement="bottom-end"
      containerPadding={0}
      showArrow
      classNames={{
        content: ["p-0"],
      }}
    >
      <PopoverTrigger>
        <Button
          size="sm"
          variant="flat"
          color={buttonColor}
          className="mt-1"
          onClick={() => {
            // TODO
          }}
        >
          {!online && <CloudOffIcon size={16} />}
          {online && user.isLoggedIn() && canUpdate && <ShareIcon size={16} />}
          {online && user.isLoggedIn() && !canUpdate && <ShareIcon size={16} />}
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        {online && user.isLoggedIn() && (!remoteRunbook || canUpdate) && (
          <Publish runbook={runbook} slug={slug} setSlug={setSlug} error={error} />
        )}
        {online && user.isLoggedIn() && remoteRunbook && !canUpdate && <NoPermission />}
        {!user.isLoggedIn() && <LoggedOut />}
        {!online && <Offline />}
      </PopoverContent>
    </Popover>
  );
}
