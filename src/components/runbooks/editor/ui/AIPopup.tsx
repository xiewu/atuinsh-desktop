import { useCallback } from "react";
import { AIPopupBase } from "./AIPopupBase";
import track_event from "@/tracking";

interface AIPopupProps {
  isOpen: boolean;
  onClose: () => void;
  editor: any; // Use any for now to avoid complex type constraints
  currentBlock: any;
  position?: { x: number; y: number };
  getEditorContext?: () => Promise<{
    blocks: any[];
    currentBlockId: string;
    currentBlockIndex: number;
  } | undefined>;
}

// Define block-specific AI suggestions
const blockSuggestions: Record<string, string[]> = {
  // Command/Script blocks
  run: [
    "Use template variables for dynamic values",
    "Add error handling and validation", 
    "Fix syntax and optimize performance",
    "Convert to different shell language",
  ],
  script: [
    "Use template variables for dynamic values",
    "Add error handling and validation", 
    "Store output in a variable",
    "Fix syntax and optimize performance",
    "Convert to different shell language",
  ],
  
  // Database blocks
  postgres: [
    "Use template variables in query",
    "Store query results in variable",
    "Optimize this SQL query",
    "Add proper indexing suggestions",
    "Convert to different SQL dialect",
  ],
  sqlite: [
    "Use template variables in query",
    "Store query results in variable",
    "Optimize this SQL query",
    "Add proper indexing suggestions",
    "Convert to different SQL dialect",
  ],
  clickhouse: [
    "Use template variables in query",
    "Store query results in variable",
    "Optimize this SQL query",
    "Add proper indexing suggestions",
    "Convert to different SQL dialect",
  ],
  
  // Network blocks
  http: [
    "Use template variables for dynamic URLs",
    "Store response in a variable",
    "Add authentication headers",
    "Improve error handling",
    "Add request validation",
  ],
  prometheus: [
    "Use template variables for dynamic queries",
    "Store metrics in a variable",
    "Improve PromQL query performance",
    "Add alerting conditions",
    "Optimize time range",
  ],
  
  // Variable blocks
  var: [
    "Change variable name",
    "Update default value",
    "Add description or comments",
    "Create related variables",
    "Set environment-specific values",
  ],
  "local-var": [
    "Change variable name",
    "Update default value",
    "Add description or comments",
    "Create related variables",
    "Set environment-specific values",
  ],
  
  // Environment blocks
  env: [
    "Use template variables in value",
    "Add environment-specific values",
    "Improve security practices",
    "Add validation or defaults",
    "Update variable naming",
  ],
};

const getBlockSuggestions = (blockType: string): string[] => {
  return blockSuggestions[blockType] || [
    "Use template variables for dynamic content",
    "Improve this content",
    "Add more detail",
    "Fix formatting",
    "Make it clearer",
  ];
};

const getBlockTypeDisplay = (blockType: string) => {
  const typeMap: Record<string, string> = {
    run: "Terminal",
    script: "Script", 
    postgres: "PostgreSQL",
    sqlite: "SQLite",
    clickhouse: "ClickHouse",
    http: "HTTP Request",
    prometheus: "Prometheus",
    var: "Variable",
    env: "Environment",
    paragraph: "Text",
  };
  return typeMap[blockType] || blockType;
};

export default function AIPopup({ isOpen, onClose, editor, currentBlock, position = { x: 0, y: 0 }, getEditorContext }: AIPopupProps) {
  const blockType = currentBlock?.type || "paragraph";
  const suggestions = getBlockSuggestions(blockType);
  const blockTypeDisplay = getBlockTypeDisplay(blockType);

  const handleEdit = useCallback(async (prompt: string) => {
    if (!currentBlock) return;
    
    track_event("runbooks.ai.edit_request", { 
      blockType, 
      promptLength: prompt.length,
      blockId: currentBlock.id 
    });
    
    // Get editor context if available
    const editorContext = getEditorContext ? await getEditorContext() : undefined;
    
    const { editBlock } = await import("@/lib/ai/block_editor");
    
    const result = await editBlock({
      prompt,
      currentBlock,
      editorContext
    });
    
    // Apply the changes to the editor
    if (result.updatedBlock) {
      editor.updateBlock(currentBlock.id, result.updatedBlock);
      
      track_event("runbooks.ai.edit_success", { 
        blockType, 
        blockId: currentBlock.id 
      });
    }
  }, [blockType, currentBlock, editor, getEditorContext]);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    track_event("runbooks.ai.suggestion_clicked", { 
      blockType, 
      suggestion,
      blockId: currentBlock?.id 
    });
  }, [blockType, currentBlock?.id]);

  return (
    <AIPopupBase
      isVisible={isOpen}
      position={position}
      onClose={onClose}
      onSubmit={handleEdit}
      title={`Edit ${blockTypeDisplay} block`}
      placeholder={`Describe how to modify this ${blockTypeDisplay.toLowerCase()} block...`}
      submitButtonText="Apply"
      submitButtonLoadingText="Applying..."
      suggestions={suggestions}
      showSuggestions={true}
      onSuggestionClick={handleSuggestionClick}
    />
  );
}
