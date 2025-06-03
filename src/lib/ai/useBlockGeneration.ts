import { useState, useCallback } from "react";
import { generateBlocks, GenerateBlocksRequest, GenerateBlocksResponse, BlockSpec, isAIEnabled } from "./block_generator";

export interface UseBlockGenerationResult {
  generateFromPrompt: (prompt: string, apiKey?: string) => Promise<BlockSpec[]>;
  isGenerating: boolean;
  error: string | null;
  lastResponse: GenerateBlocksResponse | null;
}

export function useBlockGeneration(): UseBlockGenerationResult {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<GenerateBlocksResponse | null>(null);

  const generateFromPrompt = useCallback(async (prompt: string, apiKey?: string): Promise<BlockSpec[]> => {
    setIsGenerating(true);
    setError(null);
    
    try {
      // Check if AI is enabled
      if (!(await isAIEnabled())) {
        throw new Error("AI features are disabled. Enable them in Settings to use AI-powered runbook generation.");
      }

      const request: GenerateBlocksRequest = { prompt, apiKey };
      const response = await generateBlocks(request);
      
      setLastResponse(response);
      return response.blocks;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to generate blocks";
      setError(errorMessage);
      throw err;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  return {
    generateFromPrompt,
    isGenerating,
    error,
    lastResponse
  };
}
