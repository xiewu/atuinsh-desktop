import { useRef } from "react";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Button,
  Chip,
  useDisclosure,
} from "@nextui-org/react";
import { Layers, Plus, Settings } from "lucide-react";
import { AtuinState, useStore } from "@/state/store";
import Workspace from "@/state/runbooks/workspace";
import WorkspaceSettings from "./WorkspaceSettings";
import track_event from "@/tracking";
import { allWorkspaces } from "@/lib/queries/workspaces";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const CompactWorkspaceSwitcher = () => {
  const currentWorkspaceId = useStore((store: AtuinState) => store.currentWorkspaceId);
  const setCurrentWorkspaceId = useStore((store: AtuinState) => store.setCurrentWorkspaceId);
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  // Which workspace to open the settings modal for. We cannot make the modal a child of the
  // DropDownItem, as the dropdown closes as soon as it gains focus. Boooo.
  const settingsModalWorkspaceRef = useRef<Workspace | null>(null);

  const queryClient = useQueryClient();
  const { data: workspaces } = useQuery(allWorkspaces());

  const onNewWorkspace = async () => {
    await Workspace.create("New Workspace");
    queryClient.invalidateQueries(allWorkspaces());

    track_event("workspace.create", {
      total: await Workspace.count(),
    });
  };

  return (
    <>
      <Dropdown disableAnimation>
        <DropdownTrigger>
          <Button isIconOnly variant="light" radius="full">
            <Layers size={20} className="text-default-500" />
          </Button>
        </DropdownTrigger>
        <DropdownMenu
          aria-label="Workspace selection"
          variant="flat"
          className="w-[280px]"
          topContent={<div className="text-default-600 font-semibold">Workspaces</div>}
          bottomContent={
            <Button
              onPress={onNewWorkspace}
              variant="flat"
              startContent={<Plus size={16} />}
              size="sm"
              className="w-full"
            >
              New Workspace
            </Button>
          }
          items={workspaces}
        >
          {(workspace) => {
            return (
              <DropdownItem
                key={workspace.id}
                textValue={workspace.name}
                className="py-2"
                onPress={async () => {
                  setCurrentWorkspaceId(workspace.id);
                  track_event("workspace.switch", {});
                }}
                endContent={
                  <Button
                    isIconOnly
                    onPress={() => {
                      settingsModalWorkspaceRef.current = workspace;
                      onOpen();
                      console.log("settingsModalWorkspaceRef", settingsModalWorkspaceRef.current);
                    }}
                    size="sm"
                    variant="flat"
                  >
                    <Settings size={16} />
                  </Button>
                }
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
      <WorkspaceSettings
        workspace={settingsModalWorkspaceRef.current}
        workspaceCount={workspaces?.length || 0}
        isOpen={isOpen}
        onClose={onOpenChange}
      />
    </>
  );
};

export default CompactWorkspaceSwitcher;
