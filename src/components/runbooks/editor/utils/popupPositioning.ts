// Utility functions for calculating popup positions in the editor

interface Position {
  x: number;
  y: number;
}

/**
 * Calculate position for AI popup - typically appears above or below cursor
 */
export const calculateAIPopupPosition = (editor: any, blockId?: string): Position => {
  try {
    // Get the current cursor position if no blockId provided
    const cursorPosition = editor.getTextCursorPosition();
    const targetBlockId = blockId || cursorPosition.block.id;
    
    // Get the DOM element for the target block
    const blockElement = editor.domElement?.querySelector(`[data-id="${targetBlockId}"]`);
    
    if (blockElement && editor.domElement) {
      const blockRect = blockElement.getBoundingClientRect();
      const editorRect = editor.domElement.getBoundingClientRect();
      
      // For AI popup, position near the start of the block
      const x = blockRect.left - editorRect.left + 20;
      const y = blockRect.top - editorRect.top + 10;
      
      return { x, y };
    } else {
      // Fallback position
      return { x: 50, y: 50 };
    }
  } catch (error) {
    console.warn("Could not calculate AI popup position, using fallback:", error);
    return { x: 250, y: 100 };
  }
};

/**
 * Calculate position for link popup - appears to the right of cursor
 */
export const calculateLinkPopupPosition = (editor: any, blockId?: string): Position => {
  try {
    // Get the current cursor position if no blockId provided
    const cursorPosition = editor.getTextCursorPosition();
    const targetBlockId = blockId || cursorPosition.block.id;
    
    // Get the DOM element for the target block
    const blockElement = editor.domElement?.querySelector(`[data-id="${targetBlockId}"]`);
    
    if (blockElement && editor.domElement) {
      const blockRect = blockElement.getBoundingClientRect();
      const editorRect = editor.domElement.getBoundingClientRect();
      
      // Try to get the actual cursor position within the block
      let cursorX = blockRect.left - editorRect.left;
      let cursorY = blockRect.top - editorRect.top;
      
      // Look for a text selection or cursor position
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rangeRect = range.getBoundingClientRect();
        
        // If the range is within our block, use its position
        if (rangeRect.width > 0 || rangeRect.height > 0) {
          cursorX = rangeRect.right - editorRect.left;
          cursorY = rangeRect.top - editorRect.top;
        }
      }
      
      // Position popup to the right of cursor with some padding
      const popupX = cursorX + 10;
      const popupY = cursorY;
      
      // Check if popup would go off screen and adjust
      const popupWidth = 320; // approximate popup width
      const editorWidth = editorRect.width;
      
      const finalX = popupX + popupWidth > editorWidth ? Math.max(10, editorWidth - popupWidth - 10) : popupX;
      
      return { x: finalX, y: popupY };
    } else {
      // Fallback position
      return { x: 50, y: 50 };
    }
  } catch (error) {
    console.warn("Could not calculate link popup position, using fallback:", error);
    return { x: 250, y: 100 };
  }
};

/**
 * Legacy function for backward compatibility - uses AI popup positioning
 */
export const calculatePopupPosition = calculateAIPopupPosition;
