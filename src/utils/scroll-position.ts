/**
 * Utility for persisting scroll positions across runbook switches
 * Uses localStorage to avoid IPC overhead
 */

const SCROLL_POSITION_KEY = "runbook-scroll-positions";

interface ScrollPositions {
  [runbookId: string]: number;
}

function getScrollPositions(): ScrollPositions {
  try {
    const stored = localStorage.getItem(SCROLL_POSITION_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveScrollPositions(positions: ScrollPositions): void {
  try {
    localStorage.setItem(SCROLL_POSITION_KEY, JSON.stringify(positions));
  } catch {
    // Silently fail if localStorage is unavailable
  }
}

export function saveScrollPosition(runbookId: string, scrollTop: number): void {
  const positions = getScrollPositions();
  positions[runbookId] = scrollTop;
  saveScrollPositions(positions);
}

export function getScrollPosition(runbookId: string): number {
  const positions = getScrollPositions();
  return positions[runbookId] || 0;
}

export function clearScrollPosition(runbookId: string): void {
  const positions = getScrollPositions();
  delete positions[runbookId];
  saveScrollPositions(positions);
}

/**
 * Safely restores scroll position
 */

export function restoreScrollPosition(element: HTMLElement, runbookId: string): void {
  const savedPosition = getScrollPosition(runbookId);
  const maxScroll = element.scrollHeight - element.clientHeight;
  
  if (savedPosition > 0 && savedPosition <= maxScroll) {
    element.scrollTop = savedPosition;
  }
}