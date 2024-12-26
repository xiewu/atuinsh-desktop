import { endpoint } from "@/api/api";
import { slugify, capitalize } from "@/lib/utils";
import { RemoteRunbook } from "@/state/models";
import Runbook, { RunbookVisibility } from "@/state/runbooks/runbook";
import { useStore } from "@/state/store";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Select,
  SelectItem,
  Tooltip,
} from "@nextui-org/react";
import { open } from "@tauri-apps/plugin-shell";
import { TrashIcon } from "lucide-react";

interface PublishProps {
  mode: "publish" | "edit";
  runbook: Runbook;
  remoteRunbook: RemoteRunbook | undefined;
  slug?: string;
  setSlug: (slug: string) => void;
  visibility?: RunbookVisibility;
  setVisibility: (visibility: RunbookVisibility) => void;
  error?: string;
  onPublish: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isEnabled: boolean;
}

export default function Publish(props: PublishProps) {
  const username = useStore((state) => state.user.username);
  const publishMode = props.mode === "publish";
  const runbookUrl = `${endpoint()}/${props.remoteRunbook?.nwo}`;

  const dataHasChanged =
    props.visibility !== props.remoteRunbook?.visibility ||
    props.slug !== props.remoteRunbook?.slug;

  function handleVisibilityChange(e: React.ChangeEvent<HTMLSelectElement>) {
    props.setVisibility(e.target.value as RunbookVisibility);
  }

  function handleLinkClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    open(runbookUrl);
  }

  return (
    <Card className="w-full">
      <CardHeader>
        {publishMode && <h2 className="uppercase text-gray-500">Share to Hub</h2>}
        {!publishMode && <h2 className="uppercase text-gray-500">Manage shared Runbook</h2>}
      </CardHeader>
      <CardBody className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
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
          {props.error && <p className="text-red-600 italic text-sm">{capitalize(props.error)}</p>}
          <Select
            label="Runbook visibility"
            value={props.visibility}
            onChange={handleVisibilityChange}
            selectedKeys={new Set([props.visibility as string])}
          >
            <SelectItem key="public" value="public">
              Public
            </SelectItem>
            <SelectItem key="unlisted" value="unlisted">
              Unlisted
            </SelectItem>
            <SelectItem key="private" value="private">
              Private
            </SelectItem>
          </Select>
          {!props.error && publishMode && (
            <p className={"text-sm text-gray-500 italic"}>
              Runbook will be {props.visibility} at {username}/{slugify(props.slug || "")}
            </p>
          )}
          {!publishMode && props.remoteRunbook && (
            <p className={"text-sm text-gray-500 italic"}>
              Runbook is {props.remoteRunbook.visibility} at{" "}
              <a href={runbookUrl} onClick={handleLinkClick} className="underline">
                {props.remoteRunbook.nwo}
              </a>
            </p>
          )}
        </div>
        <div className="flex flex-row">
          <Button
            isDisabled={!props.isEnabled || (!publishMode && !dataHasChanged)}
            size="sm"
            className="flex-grow"
            variant="flat"
            color="success"
            onPress={publishMode ? props.onPublish : props.onEdit}
          >
            {publishMode && <span>Push to Hub</span>}
            {!publishMode && <span>Update Shared Runbook</span>}
          </Button>
          {!publishMode && (
            <Tooltip
              content="Delete runbook from Atuin Hub"
              placement="bottom"
              showArrow
              delay={300}
            >
              <Button
                size="sm"
                variant="solid"
                color="danger"
                onPress={props.onDelete}
                className="ml-2"
              >
                <TrashIcon size={16} />
              </Button>
            </Tooltip>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
