import { useEffect } from 'react';
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Button,
  Chip,
} from "@nextui-org/react";
import { Layers, Plus } from 'lucide-react';
import { AtuinState, useStore } from '@/state/store';

const CompactWorkspaceSwitcher = () => {
  const refreshWorkspaces = useStore((store: AtuinState) => store.refreshWorkspaces);
  // const setCurrentWorkspace = useStore((store: AtuinState) => store.setCurrentWorkspace);
  const currentWorkspace = useStore((store: AtuinState) => store.workspace);
  const workspaces = useStore((store: AtuinState) => store.workspaces);

  useEffect(() => {
    refreshWorkspaces();
  }, []);

  return (
    <Dropdown>
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
        bottomContent={<Button variant="flat" isDisabled startContent={<Plus size={16} />} size="sm" className="w-full">New Workspace</Button>}
        items={workspaces}
      >
        {(workspace) => {

          return <DropdownItem
            key={workspace.name}
            className="py-2"
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
  );
};

export default CompactWorkspaceSwitcher;
