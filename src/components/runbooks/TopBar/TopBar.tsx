import Runbook from "@/state/runbooks/runbook";
import RelativeTime from "@/components/relative_time.tsx";
import SharePopover from "./SharePopover";
import TagSelector from "./TagSelector";
import { DateTime } from "luxon";
import { Avatar, AvatarGroup, Tooltip } from "@nextui-org/react";
import { RemoteRunbook } from "@/state/models";
import { BookTextIcon, PencilOffIcon } from "lucide-react";
import { PresenceUserInfo } from "@/lib/phoenix_provider";

type TopbarProps = {
  runbook: Runbook;
  remoteRunbook?: RemoteRunbook;
  refreshRemoteRunbook: () => void;
  tags: Array<{ text: string; value: string }>;
  presences: PresenceUserInfo[];
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
        <div className="flex h-full">
          {remoteRunbook && (
            <Avatar
              size="sm"
              radius="sm"
              name={remoteRunbook.user.username}
              src={remoteRunbook.user.avatar_url}
              classNames={{ base: "inline-block mr-2 mt-1" }}
            />
          )}
          {!remoteRunbook && <BookTextIcon size={24} className="mt-2 mr-2 ml-1" />}
          <div className="flex flex-col">
            <span className="mb-[-1px]">{name}</span>
            <span className="text-gray-400 text-xs italic">
              Updated <RelativeTime time={DateTime.fromJSDate(runbook.updated)} />
            </span>
          </div>
          <div className="mt-[7px]">
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
          </div>
          {props.currentTag && props.currentTag !== "latest" && (
            <div className="mt-[7px]">
              <Tooltip
                content="This runbook is in read-only mode because you are viewing a tag"
                placement="bottom"
                showArrow
              >
                <PencilOffIcon className="h-4 w-4 text-red-400 ml-4 inline" />
              </Tooltip>
            </div>
          )}
        </div>
        <div>
          <AvatarGroup
            size="sm"
            max={5}
            total={props.presences.length}
            classNames={{ base: "inline-block mr-2" }}
            renderCount={(count) => {
              if (count - 5 > 0) {
                return <span className="ml-2 text-gray-500">+{count - 5} others</span>;
              } else {
                return <span />;
              }
            }}
          >
            {props.presences.map((user) => (
              <Avatar
                isBordered
                size="sm"
                name={user.username}
                src={user.avatar_url}
                imgProps={{ title: user.username }}
                classNames={{ base: "inline-block mb-2" }}
              />
            ))}
          </AvatarGroup>
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
    <div className="flex w-full max-w-full overflow-hidden bg-gray-50 h-12 min-h-12 flex-row border-b px-2 justify-between pt-1">
      {renderBarContents()}
    </div>
  );
}
