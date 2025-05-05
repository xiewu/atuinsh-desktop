// Make a new SSH connection and set it as the current connection
// Connections are pooled globally, so if we are already connected to the host just reuse.

import { Button, Input, Tooltip } from "@heroui/react";
import { GlobeIcon } from "lucide-react";

// @ts-ignore
import { createReactBlockSpec } from "@blocknote/react";
import { insertOrUpdateBlock } from "@blocknote/core";
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
    <div className="w-full !max-w-full !outline-none overflow-none">
      <Tooltip
        content="Ensure we are connected to an SSH server and make it the current connection"
        delay={1000}
      >
        <div className="flex flex-row">
          <div className="mr-2">
            <Tooltip content="Manually connect (otherwise we will try to connect automatically when needed)">
              <Button
                isIconOnly
                variant="light"
                onPress={async () => {
                  sshConnect(userHost);
                }}
              >
                <GlobeIcon />
              </Button>
            </Tooltip>
          </div>

          <div className="w-full">
            <Input
              placeholder="root@localhost:22"
              value={userHost}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck="false"
              onValueChange={(val) => {
                onUserHostChange(val);
              }}
              disabled={!isEditable}
            />
          </div>
        </div>
      </Tooltip>
    </div>
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
    
    insertOrUpdateBlock(editor, {
      type: "ssh-connect",
    });
  },
  icon: <GlobeIcon size={18} />,
  group: "Network",
});
