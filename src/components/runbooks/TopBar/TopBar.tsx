import Runbook from "@/state/runbooks/runbook";
import RelativeTime from "@/components/relative_time.tsx";
import SharePopover from "./SharePopover";
import TagSelector from "./TagSelector";
import { DateTime } from "luxon";
import { Avatar, Tooltip } from "@nextui-org/react";
import { RemoteRunbook } from "@/state/models";
import { PencilOffIcon } from "lucide-react";

type TopbarProps = {
  runbook: Runbook;
  remoteRunbook?: RemoteRunbook;
  refreshRemoteRunbook: () => void;
  tags: Array<{ text: string; value: string }>;
  currentTag: string | null;
  showTagMenu: boolean;
  canEditTags: boolean;
  canInviteCollaborators: boolean;
  onSelectTag: (tag: string | null) => void;
  onCreateTag: (tag: string) => Promise<void>;
  onOpenTagMenu: () => void;
  onCloseTagMenu: () => void;
  onShareToHub: () => void;
  onDeleteFromHub: () => void;
};

export default function Topbar(props: TopbarProps) {
  let runbook = props.runbook;
  let remoteRunbook = props.remoteRunbook;

  let name: string;
  if (remoteRunbook) {
    name = remoteRunbook.nwo;
  } else {
    name = runbook.name;
  }

  function onSelectTag(tag: string) {
    props.onSelectTag(tag);
  }

  const renderBarContents = () => {
    return (
      <>
        <div>
          <div className="h-full content-center">
            {remoteRunbook && (
              <Avatar
                size="sm"
                radius="sm"
                name={remoteRunbook.user.username}
                src={remoteRunbook.user.avatar_url}
                classNames={{ base: "inline-block mr-2" }}
              />
            )}
            {name}
            {(props.tags.length > 0 || props.canEditTags) && (
              <TagSelector
                runbookId={runbook.id}
                isOpen={props.showTagMenu}
                onTrigger={props.onOpenTagMenu}
                onClose={props.onCloseTagMenu}
                tags={props.tags}
                currentTag={props.currentTag}
                canEditTags={props.canEditTags}
                onSelectTag={onSelectTag}
                onCreateTag={props.onCreateTag}
              />
            )}
            {props.currentTag && props.currentTag !== "latest" && (
              <Tooltip
                content="This runbook is in read-only mode because you are viewing a tag"
                placement="bottom"
                showArrow
              >
                <PencilOffIcon className="h-4 w-4 text-red-400 ml-4 inline" />
              </Tooltip>
            )}
          </div>
        </div>
        <div>
          <span className="h-full content-center text-gray-400 text-xs italic mr-4">
            Updated <RelativeTime time={DateTime.fromJSDate(runbook.updated)} />
          </span>
          <SharePopover
            onShareToHub={props.onShareToHub}
            onDeleteFromHub={props.onDeleteFromHub}
            runbook={runbook}
            remoteRunbook={props.remoteRunbook}
            refreshRemoteRunbook={props.refreshRemoteRunbook}
          />
        </div>
      </>
    );
  };

  return (
    <div className="flex w-full max-w-full overflow-hidden bg-gray-50 h-10 min-h-10 flex-row border-b px-2 justify-between">
      {renderBarContents()}
    </div>
  );
}
