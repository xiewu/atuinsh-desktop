import { runbooksByWorkspaceId } from "@/lib/queries/runbooks";
import { allWorkspaces } from "@/lib/queries/workspaces";
import Runbook from "@/state/runbooks/runbook";
import { AtuinState, useStore } from "@/state/store";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Chip } from "@heroui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface MoveRunbookDropdownProps {
  runbook: Runbook;
  isOpen: boolean;
  onClose: () => void;
}

export default function MoveRunbookDropdown({
  runbook,
  isOpen,
  onClose,
}: MoveRunbookDropdownProps) {
  const currentWorkspaceId = useStore((store: AtuinState) => store.currentWorkspaceId);
  const setCurrentWorkspaceId = useStore((store: AtuinState) => store.setCurrentWorkspaceId);
  const currentRunbookId = useStore((store: AtuinState) => store.currentRunbookId);
  const setCurrentRunbookId = useStore((store: AtuinState) => store.setCurrentRunbookId);
  const refreshRunbooks = useStore((store: AtuinState) => store.refreshRunbooks);

  const queryClient = useQueryClient();
  const { data: workspaces } = useQuery(allWorkspaces());

  return (
    <Dropdown isOpen={isOpen} placement="right-start" className="absolute left-[7rem] top-[-1rem]">
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
          return (
            <DropdownItem
              key={workspace.name}
              textValue={workspace.name}
              className="py-2"
              onPress={async () => {
                await runbook.moveTo(workspace.id);
                if (currentRunbookId === runbook.id) {
                  setCurrentWorkspaceId(workspace.id);
                  setCurrentRunbookId(runbook.id);
                }
                queryClient.invalidateQueries(runbooksByWorkspaceId(currentWorkspaceId));
                queryClient.invalidateQueries(runbooksByWorkspaceId(workspace.id));
                queryClient.invalidateQueries(allWorkspaces());
                await refreshRunbooks();

                onClose();
              }}
            >
              <div className="flex items-center gap-2">
                <div className="flex flex-col">
                  <span className="text-small font-semibold">{workspace.name}</span>
                  <span className="text-tiny text-default-400">
                    {workspace.meta?.totalRunbooks} runbooks
                  </span>
                </div>
                {workspace.id === currentWorkspaceId && (
                  <Chip size="sm" color="success" variant="flat" className="ml-auto">
                    Current
                  </Chip>
                )}
              </div>
            </DropdownItem>
          );
        }}
      </DropdownMenu>
    </Dropdown>
  );
}
