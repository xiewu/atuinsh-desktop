import Runbook from "@/state/runbooks/runbook";
import { AtuinState, useStore } from "@/state/store";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Chip } from "@nextui-org/react";

interface MoveRunbookDropdownProps {
  runbook: Runbook;
  isOpen: boolean;
  onClose: () => void;
}

export default function MoveRunbookDropdown({ runbook, isOpen, onClose }: MoveRunbookDropdownProps) {
  const workspaces = useStore((store: AtuinState) => store.workspaces);
  const currentWorkspace = useStore((store: AtuinState) => store.workspace);
  const refreshWorkspaces = useStore((store: AtuinState) => store.refreshWorkspaces);
  const refreshRunbooks = useStore((store: AtuinState) => store.refreshRunbooks);

  return (
    <Dropdown isOpen={isOpen} placement="right-start" className="ml-32">
      <DropdownTrigger title="Move to">
        <span className="w-full">Move to</span>
      </DropdownTrigger>
      <DropdownMenu
        aria-label="Workspace selection"
        variant="flat"
        topContent={<div className="text-default-600 font-semibold">Workspaces</div>}
        items={workspaces}
      >
        {(workspace) => {
          return <DropdownItem key={workspace.name} textValue={workspace.name} className="py-2" onPress={async () => {
            await runbook.moveTo(workspace);
            await refreshRunbooks();
            await refreshWorkspaces();

            onClose();
          }}
          >
            <div className="flex items-center gap-2">
              <div className="flex flex-col">
                <span className="text-small font-semibold">{workspace.name}</span>
                <span className="text-tiny text-default-400">{workspace.meta?.totalRunbooks} runbooks</span>
              </div>
              {workspace.id === currentWorkspace?.id && (
                <Chip size="sm" color="success" variant="flat" className="ml-auto">
                  Current
                </Chip>
              )}

            </div>
          </DropdownItem>
        }}
      </DropdownMenu>
    </Dropdown>
  )
}
