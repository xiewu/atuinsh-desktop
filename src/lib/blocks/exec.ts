// Helpers to make writing blocks easier
// Called "exec", as these are all helpers for executing commands

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