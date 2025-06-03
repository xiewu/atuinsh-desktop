import { useCallback } from "react";
import { generateBlocks, GenerateBlocksRequest } from "@/lib/ai/block_generator";
import { AIPopupBase } from "./ui/AIPopupBase";
import track_event from "@/tracking";

interface AIGeneratePopupProps {
  isVisible: boolean;
  position: { x: number; y: number };
  onGenerate: (blocks: any[]) => void;
  onClose: () => void;
  getEditorContext?: () => Promise<{
    blocks: any[];
    currentBlockId: string;
    currentBlockIndex: number;
  } | undefined>;
}

export function AIGeneratePopup({ isVisible, position, onGenerate, onClose, getEditorContext }: AIGeneratePopupProps) {
  const handleGenerate = useCallback(async (prompt: string) => {
    track_event("runbooks.ai.generate_popup", { prompt_length: prompt.length });
    
    // Get editor context if available
    const editorContext = getEditorContext ? await getEditorContext() : undefined;
    
    const request: GenerateBlocksRequest = { 
      prompt,
      editorContext 
    };
    const response = await generateBlocks(request);
    
    track_event("runbooks.ai.generate_success", { 
      blocks_generated: response.blocks.length,
      prompt_length: prompt.length 
    });

    onGenerate(response.blocks);
  }, [onGenerate, getEditorContext]);

  return (
    <AIPopupBase
      isVisible={isVisible}
      position={position}
      onClose={onClose}
      onSubmit={handleGenerate}
      title="Generate blocks"
      placeholder="e.g., Deploy a React app to production, Set up a PostgreSQL backup script..."
      submitButtonText="Generate"
      submitButtonLoadingText="Generating..."
      showSuggestions={false}
    />
  );
}
