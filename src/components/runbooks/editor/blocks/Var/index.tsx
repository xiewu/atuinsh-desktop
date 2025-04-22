import React from "react";
import { Input, Tooltip, Button } from "@heroui/react";
import { TextCursorInputIcon } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

// @ts-ignore
import { createReactBlockSpec } from "@blocknote/react";
import { useStore } from "@/state/store";

interface VarProps {
  name: string;
  value: string;
  isEditable: boolean;
  onUpdate: (name: string, value: string) => void;
}

const Var = ({ name = "", value = "", onUpdate, isEditable }: VarProps) => {
  const handleKeyChange = (e: React.FormEvent<HTMLInputElement>) => {
    onUpdate(e.currentTarget.value, value);
  };

  const handleValueChange = (e: React.FormEvent<HTMLInputElement>) => {
    onUpdate(name, e.currentTarget.value);
  };

  return (
    <Tooltip
      content="Set a template variable for subsequent blocks"
      delay={1000}
      className="outline-none"
    >
      <div className="flex flex-row items-center space-x-2 w-full ">
        <div className="flex flex-1 flex-row gap-2 ">
          <div className="">
            <Button isIconOnly isDisabled variant="light">
              <TextCursorInputIcon />
            </Button>
          </div>

          <div className="flex-grow">
            <Input
              placeholder="Name"
              value={name}
              onChange={handleKeyChange}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck="false"
              className="flex-1"
              disabled={!isEditable}
            />
          </div>
        </div>

        <div className="flex-1">
          <Input
            placeholder="Value"
            value={value}
            onChange={handleValueChange}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck="false"
            className="flex-1"
            disabled={!isEditable}
          />
        </div>
      </div>
    </Tooltip>
  );
};

export default createReactBlockSpec(
  {
    type: "var",
    propSchema: {
      name: { default: "" },
      value: { default: "" },
    },
    content: "none",
  },
  {
    // @ts-ignore
    render: ({ block, editor }) => {
      const currentRunbookId = useStore((store) => store.currentRunbookId);
      
      const onUpdate = (name: string, value: string): void => {
        // First update the block props
        editor.updateBlock(block, {
          // @ts-ignore
          props: { ...block.props, name: name, value: value },
        });
        
        // Then update the template variable in the backend state
        if (name && currentRunbookId) {
          invoke("set_template_var", {
            runbook: currentRunbookId,
            name,
            value,
          }).catch(console.error);
        }
      };

      return (
        <Var
          name={block.props.name}
          value={block.props.value}
          onUpdate={onUpdate}
          isEditable={editor.isEditable}
        />
      );
    },
  },
); 