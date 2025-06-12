// Helpers to make writing blocks easier
// Called "exec", as these are all helpers for executing commands

import { templateString } from "@/state/templates";
import { KVStore } from "@/state/kv";

/**
 * Find the first parent block of a specific type or types
 * @param editor The editor instance
 * @param id The ID of the current block
 * @param types A single type string or an array of type strings to look for
 * @returns The first parent block of the specified type(s), or null if none found
 */
export const findFirstParentOfType = (editor: any, id: string, types: string | string[]): any => {
  // TODO: the types for blocknote aren't working. Now I'm doing this sort of shit,
  // really need to fix that.
  const document = editor.document;
  var lastOfType = null;
  const typeArray = Array.isArray(types) ? types : [types];

  // Iterate through ALL of the blocks.
  for (let i = 0; i < document.length; i++) {
    if (document[i].id == id) return lastOfType;

    if (typeArray.includes(document[i].type)) lastOfType = document[i];
  }

  return lastOfType;
};

export const findAllParentsOfType = (editor: any, id: string, type: string): any[] => {
  const document = editor.document;
  let blocks: any[] = [];

  // Iterate through ALL of the blocks.
  for (let i = 0; i < document.length; i++) {
    if (document[i].id == id) return blocks;

    if (document[i].type == type) blocks.push(document[i]);
  }

  return blocks;
};

/**
 * Calculate the current working directory for a block by finding its parent directory block
 * @param editor The editor instance
 * @param blockId The ID of the current block
 * @param runbookId The current runbook ID (for templating)
 * @returns Promise<string> The templated directory path, or "~" if no directory parent found
 */
export const getCurrentDirectory = async (editor: any, blockId: string, runbookId: string | null): Promise<string> => {
  // Check for both directory and local-directory blocks
  const directoryBlock = findFirstParentOfType(editor, blockId, ["directory", "local-directory"]);
  
  if (directoryBlock) {
    if (directoryBlock.type === "directory") {
      // Traditional directory block - uses props.path
      const rawPath = directoryBlock.props.path || "~";
      return (await templateString(blockId, rawPath, editor.document, runbookId)).trim();
    } else if (directoryBlock.type === "local-directory") {
      // Local directory block - get path from KV store
      try {
        const kvStore = await KVStore.open_default();
        const storedPath = await kvStore.get<string>(`block.${directoryBlock.id}.path`);
        
        if (storedPath) {
          // Apply templating to local directory path as well
          return (await templateString(blockId, storedPath, editor.document, runbookId)).trim();
        }
      } catch (error) {
        console.error("Failed to get path from KV store:", error);
      }
    }
  }
  
  return "~";
};