import { NodeRendererProps } from "react-arborist";
import { RunbookRowData } from "./RunbookTreeRow";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import InlineInput from "./InlineInput";
import { useStore } from "@/state/store";

export interface FolderRowData {
  type: "folder";
  id: string;
  name: string;
  children: RunbookRowData[];
}

export interface FolderTreeRowProps extends NodeRendererProps<FolderRowData> {
  onContextMenu: (evt: React.MouseEvent<HTMLDivElement>, itemId: string) => void;
}

export default function FolderTreeRow(props: FolderTreeRowProps) {
  const sidebarClickStyle = useStore((state) => state.sidebarClickStyle);

  function handleClick(evt: React.MouseEvent<HTMLDivElement>) {
    if (evt.shiftKey || evt.ctrlKey || evt.metaKey) {
      //
    } else {
      if (props.node.isSelected && props.node.isInternal) {
        props.node.toggle();
      } else {
        props.node.select();
      }
    }
  }

  function handleToggle(evt: React.MouseEvent<SVGSVGElement>) {
    evt.stopPropagation();
    props.node.toggle();
  }

  function handleRenameSubmit(value: string) {
    props.node.submit(value);
  }

  function handleRenameCancel() {
    props.node.reset();
  }

  async function handleOpenFolderMenu(evt: any) {
    props.onContextMenu(evt, props.node.data.id);
  }

  return (
    <div
      key={props.node.data.id}
      className={cn([
        "flex items-center gap-1 text-sm font-medium",
        props.node.state,
        {
          "cursor-pointer": sidebarClickStyle === "link",
          "bg-blue-200 dark:bg-blue-900": props.node.isSelected,
          "border border-1 border-blue-400": props.node.isSelectedEnd,
        },
      ])}
      ref={props.dragHandle}
      style={props.style}
      onClick={handleClick}
      onContextMenu={handleOpenFolderMenu}
    >
      <div className="ml-[6px] flex flex-row">
        {props.node.isOpen ? (
          <ChevronDownIcon
            size={12}
            className="min-w-[12px] inline mr-[6px] mt-1"
            onClick={handleToggle}
          />
        ) : (
          <ChevronRightIcon
            size={12}
            className="min-w-[12px] inline mr-[6px] mt-1"
            onClick={handleToggle}
          />
        )}
        {props.node.isEditing && (
          <span>
            <InlineInput
              value={props.node.data.name}
              onSubmit={handleRenameSubmit}
              onCancel={handleRenameCancel}
            />
          </span>
        )}
        {!props.node.isEditing && (
          <span className="overflow-hidden whitespace-nowrap text-ellipsis">
            {props.node.data.name}
          </span>
        )}
      </div>{" "}
    </div>
  );
}
