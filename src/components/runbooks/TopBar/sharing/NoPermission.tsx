import { open } from "@tauri-apps/plugin-shell";
import { endpoint } from "@/api/api";
import { RemoteRunbook } from "@/state/models";
import { Card, CardBody, CardHeader } from "@nextui-org/react";

interface NoPermissionProps {
  remoteRunbook: RemoteRunbook;
}

export default function NoPermission(props: NoPermissionProps) {
  const runbookUrl = `${endpoint()}/${props.remoteRunbook?.nwo}`;

  function handleLinkClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    open(runbookUrl);
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <h2 className="uppercase text-gray-500">Insufficient permissions</h2>
      </CardHeader>
      <CardBody>
        <p className="mb-2">
          You do not have appropriate permission to edit this runbook's settings.
        </p>

        <p className={"text-sm text-gray-500 italic"}>
          Runbook is {props.remoteRunbook.visibility} at{" "}
          <a href={runbookUrl} onClick={handleLinkClick} className="underline">
            {props.remoteRunbook.nwo}
          </a>
        </p>
      </CardBody>
    </Card>
  );
}
