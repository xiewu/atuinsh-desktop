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
      <div className="flex flex-row items-center space-x-3 w-full bg-gradient-to-r from-green-50 to-emerald-50 dark:from-slate-800 dark:to-emerald-950 rounded-lg p-3 border border-green-200 dark:border-green-900 shadow-sm hover:shadow-md transition-all duration-200">
        <div className="flex items-center">
          <Button isIconOnly variant="light" className="bg-green-100 dark:bg-green-800 text-green-600 dark:text-green-300">
            <TextCursorInputIcon className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1">
          <Input
            placeholder="Name"
            value={name}
            onChange={handleKeyChange}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck="false"
            className="flex-1 border-green-200 dark:border-green-800 focus:ring-green-500"
            disabled={!isEditable}
          />
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
            className="flex-1 border-green-200 dark:border-green-800 focus:ring-green-500"
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