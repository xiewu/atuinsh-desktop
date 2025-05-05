import React from "react";
import { Tooltip, Button, Input } from "@heroui/react";
import { EyeIcon } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

// @ts-ignore
import { createReactBlockSpec } from "@blocknote/react";
import { useStore } from "@/state/store";

/**
 * Props for the VarDisplay component that shows a live preview of a template variable
 */
interface VarDisplayProps {
  name: string;           // Name of the variable to display
  isEditable: boolean;    // Whether the component is editable 
  onUpdate: (name: string) => void; // Callback for name changes
}

/**
 * Displays the current value of a template variable
 * Refreshes automatically every 2 seconds to keep values in sync
 */
const VarDisplay = ({ name = "", isEditable, onUpdate }: VarDisplayProps) => {
  const [value, setValue] = React.useState<string>("");
  const [loading, setLoading] = React.useState<boolean>(false);
  const currentRunbookId = useStore((store) => store.currentRunbookId);

  const handleNameChange = (e: React.FormEvent<HTMLInputElement>) => {
    onUpdate(e.currentTarget.value);
  };

  // Fetches the current variable value from the backend
  const fetchValue = React.useCallback(async () => {
    if (!name || !currentRunbookId) {
      setValue("");
      return;
    }

    setLoading(true);
    try {
      const result = await invoke("get_template_var", {
        runbook: currentRunbookId,
        name,
      });
      setValue((result as string) || "");
    } catch (error) {
      console.error("Error fetching template var:", error);
      setValue(""); // Reset to empty on error
    } finally {
      setLoading(false);
    }
  }, [name, currentRunbookId]);

  React.useEffect(() => {
    fetchValue();
    
    // Auto-refresh to keep the display updated with latest values
    // Important when other blocks modify the same variable
    const intervalId = setInterval(fetchValue, 2000);
    return () => clearInterval(intervalId);
  }, [fetchValue]);

  return (
    <Tooltip
      content="Display a template variable's current value"
      delay={1000}
      className="outline-none"
    >
      <div className="flex flex-row items-center space-x-3 w-full bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-indigo-950 rounded-lg p-3 border border-blue-200 dark:border-blue-900 shadow-sm hover:shadow-md transition-all duration-200">
        <div className="flex items-center">
          <Button isIconOnly variant="light" className="bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300">
            <EyeIcon className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex-1">
          <Input
            placeholder="Variable name"
            value={name}
            onChange={handleNameChange}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck="false"
            className="flex-1 border-blue-200 dark:border-blue-800 focus:ring-blue-500"
            disabled={!isEditable}
          />
        </div>
        
        <div className="flex-1 bg-white dark:bg-slate-900 rounded-md px-4 py-2 border border-blue-200 dark:border-blue-800 font-mono text-sm">
          {loading ? 
            <span className="text-gray-500 dark:text-gray-400 animate-pulse">Loading...</span> : 
            value || <span className="italic text-gray-500 dark:text-gray-400">(empty)</span>}
        </div>
      </div>
    </Tooltip>
  );
};

/**
 * BlockNote block specification for the VarDisplay component
 * Renders a read-only display of a template variable's current value
 */
export default createReactBlockSpec(
  {
    type: "var_display",
    propSchema: {
      name: { default: "" }, // Name of the variable to display
    },
    content: "none", // This block doesn't need to store content
  },
  {
    // @ts-ignore
    render: ({ block, editor }) => {
      // Updates the block's stored variable name when changed by user
      const onUpdate = (name: string): void => {
        editor.updateBlock(block, {
          // @ts-ignore
          props: { ...block.props, name },
        });
      };
      
      return (
        <VarDisplay
          name={block.props.name}
          onUpdate={onUpdate}
          isEditable={editor.isEditable}
        />
      );
    },
  },
);