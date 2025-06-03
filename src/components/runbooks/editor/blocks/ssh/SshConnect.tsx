// Make a new SSH connection and set it as the current connection
// Connections are pooled globally, so if we are already connected to the host just reuse.

import { Button, Input, Tooltip } from "@heroui/react";
import { GlobeIcon } from "lucide-react";

// @ts-ignore
import { createReactBlockSpec } from "@blocknote/react";

import { sshConnect } from "./ssh";
import EditorBus from "@/lib/buses/editor";
import { useEffect } from "react";
import track_event from "@/tracking";

interface SshConnectProps {
  userHost: string; // foo@bar, combine for natural-ness
  onUserHostChange: (userHost: string) => void;
  isEditable: boolean;
}

const SshConnect = ({ userHost, onUserHostChange, isEditable }: SshConnectProps) => {
  useEffect(() => {
    EditorBus.get().emitBlockInserted("ssh-connect", {
      userHost,
    });
    return () => {
      EditorBus.get().emitBlockDeleted("ssh-connect", {
        userHost,
      });
    };
  }, [userHost]);

  return (
    <Tooltip
      content="Ensure we are connected to an SSH server and make it the current connection"
      delay={1000}
      className="outline-none"
    >
      <div className="flex flex-row items-center space-x-3 w-full bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-slate-900 rounded-lg p-3 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all duration-200">
        <div className="flex items-center">
          <Tooltip content="Manually connect (otherwise we will try to connect automatically when needed)">
            <Button
              isIconOnly
              variant="light"
              className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              onPress={async () => {
                sshConnect(userHost);
              }}
            >
              <GlobeIcon className="h-4 w-4" />
            </Button>
          </Tooltip>
        </div>

        <div className="flex-1">
          <Input
            placeholder="root@localhost:22"
            value={userHost}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck="false"
            className="flex-1 border-slate-200 dark:border-slate-700 focus:ring-slate-500"
            onValueChange={(val) => {
              onUserHostChange(val);
            }}
            disabled={!isEditable}
          />
        </div>
      </div>
    </Tooltip>
  );
};

export default createReactBlockSpec(
  {
    type: "ssh-connect",
    propSchema: {
      userHost: { default: "" },
    },
    content: "none",
  },
  {
    // @ts-ignore
    render: ({ block, editor, code, type }) => {
      const onUserHostChange = (val: string) => {
        editor.updateBlock(block, {
          // @ts-ignore
          props: { ...block.props, userHost: val },
        });
      };

      return (
        <SshConnect
          userHost={block.props.userHost}
          onUserHostChange={onUserHostChange}
          isEditable={editor.isEditable}
        />
      );
    },
  },
);

export const insertSshConnect = (schema: any) => (editor: typeof schema.BlockNoteEditor) => ({
  title: "SSH Connect",
  onItemClick: () => {
    track_event("runbooks.block.create", { type: "ssh-connect" });
    
    editor.insertBlocks(
      [
        {
          type: "ssh-connect",
        },
      ],
      editor.getTextCursorPosition().block.id,
      "before",
    );
  },
  icon: <GlobeIcon size={18} />,
  group: "Network",
});
