import { describe, it, expect, beforeEach, vi } from 'vitest';
import { saveScrollPosition, getScrollPosition, restoreScrollPosition } from './scroll-position';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

// @ts-ignore
global.localStorage = localStorageMock;

describe('scroll-position utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  it('should save and retrieve scroll position', () => {
    localStorageMock.getItem.mockReturnValue('{"runbook-123":250}');
    
    const position = getScrollPosition('runbook-123');
    expect(position).toBe(250);
  });

  it('should return 0 for unknown runbook', () => {
    localStorageMock.getItem.mockReturnValue('{}');
    
    const position = getScrollPosition('unknown-runbook');
    expect(position).toBe(0);
  });

  it('should save scroll position to localStorage', () => {
    localStorageMock.getItem.mockReturnValue('{}');
    
    saveScrollPosition('runbook-123', 500);
    
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'runbook-scroll-positions',
      '{"runbook-123":500}'
    );
  });

  it('should restore scroll position within bounds', () => {
    const mockElement = {
      scrollHeight: 2000,
      clientHeight: 800,
      scrollTop: 0,
    } as HTMLElement;

    localStorageMock.getItem.mockReturnValue('{"runbook-123":600}');
    
    restoreScrollPosition(mockElement, 'runbook-123');
    
    expect(mockElement.scrollTop).toBe(600);
  });

  it('should ignore scroll position beyond bounds', () => {
    const mockElement = {
      scrollHeight: 1000,
      clientHeight: 800,
      scrollTop: 0,
    } as HTMLElement;

    localStorageMock.getItem.mockReturnValue('{"runbook-123":500}');
    
    restoreScrollPosition(mockElement, 'runbook-123');
    
    // Should not change scrollTop since saved position (500) > maxScroll (200)
    expect(mockElement.scrollTop).toBe(0);
  });

  it('should handle localStorage errors gracefully', () => {
    localStorageMock.getItem.mockImplementation(() => {
      throw new Error('localStorage unavailable');
    });
    
    expect(() => getScrollPosition('runbook-123')).not.toThrow();
    expect(getScrollPosition('runbook-123')).toBe(0);
  });
});
