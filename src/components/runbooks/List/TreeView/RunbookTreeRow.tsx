import { cn, usernameFromNwo } from "@/lib/utils";
import { Tooltip } from "@heroui/react";
import { BookLockIcon, BookPlusIcon, BookTextIcon, Terminal } from "lucide-react";
import { NodeRendererProps } from "react-arborist";
import { useStore } from "@/state/store";
import { usePtyStore } from "@/state/ptyStore";
import { useRef } from "react";
import Runbook from "@/state/runbooks/runbook";
import { RemoteRunbook } from "@/state/models";

export interface RunbookRowData {
  type: "runbook";
  id: string;
  name: string;
}

export interface RunbookTreeRowProps extends NodeRendererProps<RunbookRowData> {
  runbook: Runbook;
  onContextMenu: (evt: React.MouseEvent<HTMLDivElement>, itemId: string) => void;
}

export default function RunbookTreeRow(props: RunbookTreeRowProps) {
  const ptys = usePtyStore((state) => state.ptys);
  const count = Object.values(ptys).filter((pty) => pty.runbook === props.node.id).length;
  const sidebarClickStyle = useStore((state) => state.sidebarClickStyle);
  const currentRunbookId = useStore((state) => state.currentRunbookId);
  const isActive = currentRunbookId === props.node.id;

  let lastClick = useRef<number>(0);

  function handleClick(evt: React.MouseEvent<HTMLDivElement>) {
    evt.preventDefault();
    evt.stopPropagation();

    if (sidebarClickStyle === "link") {
      if (evt.shiftKey) {
        props.node.selectContiguous();
      } else if (evt.ctrlKey || evt.metaKey) {
        props.node.selectMulti();
      } else {
        props.node.select();
        props.node.activate();
      }
    } else {
      if (evt.shiftKey) {
        props.node.selectContiguous();
      } else if (evt.ctrlKey || evt.metaKey) {
        props.node.selectMulti();
      } else {
        props.node.select();
      }

      if (lastClick.current) {
        const delta = Date.now() - lastClick.current;
        if (delta < 500) {
          console.log("double click");
          props.node.activate();
        }
      }

      lastClick.current = Date.now();
    }
  }

  async function handleRightClickRunbook(evt: React.MouseEvent<HTMLDivElement>) {
    props.onContextMenu(evt, props.node.data.id);
  }

  let hubRunbookOwnedByUser = false;
  let hubRunbookNotOwnedButHasPermission = false;
  let hubRunbookNotOwnedAndNoPermission = false;
  let RunbookIcon = BookTextIcon;

  if (props.runbook && props.runbook.remoteInfo) {
    const remoteInfo: RemoteRunbook = JSON.parse(props.runbook.remoteInfo);
    hubRunbookOwnedByUser = usernameFromNwo(remoteInfo.nwo) === useStore.getState().user?.username;
    hubRunbookNotOwnedButHasPermission =
      !hubRunbookOwnedByUser && remoteInfo.permissions.includes("update_content");
    hubRunbookNotOwnedAndNoPermission =
      !hubRunbookOwnedByUser && !hubRunbookNotOwnedButHasPermission;

    if (hubRunbookNotOwnedButHasPermission) {
      RunbookIcon = BookPlusIcon;
    } else if (hubRunbookNotOwnedAndNoPermission) {
      RunbookIcon = BookLockIcon;
    }
  }

  return (
    <div
      ref={props.dragHandle}
      style={props.style}
      onClick={handleClick}
      onContextMenu={handleRightClickRunbook}
      className={cn(
        `relative text-ellipsis overflow-hidden hover:bg-gray-100 dark:hover:bg-gray-900 p-[1px]`,
        {
          "cursor-pointer": sidebarClickStyle === "link",
          "bg-blue-200 dark:bg-blue-900 border border-1 border-blue-200 dark:bg-blue-900":
            props.node.isSelected,
          "border border-1 border-blue-400": props.node.isSelectedEnd,
          "bg-gray-100 dark:bg-gray-800": isActive,
        },
      )}
    >
      <div className={cn("flex justify-between items-start ml-1", {})}>
        <h3
          className={cn(
            "text-sm overflow-hidden whitespace-nowrap text-ellipsis text-gray-600 dark:text-gray-400",
            {
              "text-foreground dark:text-gray-200": isActive,
            },
          )}
        >
          <RunbookIcon
            className={cn("w-4 h-4 mr-1 inline-block", {
              "stroke-green-700 dark:stroke-green-500": hubRunbookOwnedByUser,
              "stroke-blue-600 dark:stroke-blue-400": hubRunbookNotOwnedButHasPermission,
              "stroke-orange-600 dark:stroke-orange-400": hubRunbookNotOwnedAndNoPermission,
            })}
          />
          {props.runbook && !props.runbook.viewed_at && (
            <div className="rounded-lg bg-blue-500 w-2 h-2 inline-block mr-1 mb-[1px]" />
          )}
          {(props.runbook && props.runbook.name) || "Untitled"}
        </h3>
        <div className="flex items-center">
          {count > 0 && (
            <Tooltip content={`${count} active terminal${count > 1 ? "s" : ""}`}>
              <div className="flex items-center text-primary-500 ml-1 mr-2 mt-1">
                <Terminal size={14} />
                <span className="text-xs ml-1">{count}</span>
              </div>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );
}
