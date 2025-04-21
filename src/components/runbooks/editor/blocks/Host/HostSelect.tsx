// Specify which host commands should run on
// Currently only supports local execution

import { Button, Tooltip } from "@heroui/react";
import { HomeIcon } from "lucide-react";

// @ts-ignore
import { createReactBlockSpec } from "@blocknote/react";
import { insertOrUpdateBlock } from "@blocknote/core";

interface HostSelectProps {
  isEditable: boolean;
}

const HostSelect = ({ }: HostSelectProps) => {
  return (
    <div className="w-full !max-w-full !outline-none overflow-none">
      <Tooltip
        content="Specifies that commands run on the local machine"
        delay={1000}
      >
        <div className="flex flex-row items-center w-full">
          <div className="mr-2">
            <HomeIcon size={18} />
          </div>
          
          <div className="flex-grow">
            <Button 
              variant="flat"
              className="text-sm w-full justify-start"
              disabled={true} // Always disabled since we only support localhost
            >
              localhost
            </Button>
          </div>
        </div>
      </Tooltip>
    </div>
  );
};

export default createReactBlockSpec(
  {
    type: "host-select",
    propSchema: {
      host: { default: "local" },
    },
    content: "none",
  },
  {
    // @ts-ignore
    render: ({ block, editor }) => {
      return (
        <HostSelect
          isEditable={editor.isEditable}
        />
      );
    },
  },
);

export const insertHostSelect = (schema: any) => (editor: typeof schema.BlockNoteEditor) => ({
  title: "Host",
  subtext: "Specify that commands run on localhost",
  onItemClick: () => {
    insertOrUpdateBlock(editor, {
      type: "host-select",
    });
  },
  icon: <HomeIcon size={18} />,
  group: "Network",
}); 