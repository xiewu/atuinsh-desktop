import { open } from "@tauri-apps/plugin-shell";
import { endpoint } from "@/api/api";
import { RemoteRunbook } from "@/state/models";
import Runbook from "@/state/runbooks/runbook";
import { Button, Card, CardBody, CardHeader, Input } from "@nextui-org/react";

interface EditProps {
  runbook: Runbook;
  remoteRunbook: RemoteRunbook;
  slug?: string;
  setSlug: (slug: string) => void;
  error?: string;
}

function remoteRunbookUrl(rb: RemoteRunbook): string {
  return `${endpoint()}/${rb.nwo}`;
}

export default function Edit(props: EditProps) {
  function openRemoteRunbook(e: React.MouseEvent) {
    e.preventDefault();
    const url = remoteRunbookUrl(props.remoteRunbook);
    open(url);
  }

  return (
    <Card className="w-96">
      <CardHeader>
        <h2 className="uppercase text-gray-500">Manage shared runbook</h2>
      </CardHeader>
      <CardBody className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <p>
            Your runbook is available at{" "}
            <a href="#" onClick={openRemoteRunbook}>
              {remoteRunbookUrl(props.remoteRunbook)}
            </a>
          </p>
          <Input
            label="slug"
            variant="bordered"
            value={props.slug}
            onValueChange={props.setSlug}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck="false"
          />
          {props.error && <div className="text-red-600 italic text-sm">{props.error}</div>}
        </div>
        <div className="flex flex-row">
          {/* <VisibilityDropdown onValueChange={setVisibility} /> */}
          <Button
            // disabled={!props.slugAvailable || props.success}
            disabled={true}
            size="sm"
            className="flex-grow"
            variant="flat"
            color="success"
            onClick={() => {
              // if (!slug) return;
              // shareRunbook(runbook, slug, visibility, () => setSuccess(true));
            }}
          >
            Update Shared Runbook
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
