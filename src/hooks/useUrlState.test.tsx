import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useUrlState } from './useUrlState';

describe('useUrlState', () => {
  it('syncs state with URL params', () => {
    window.history.pushState({}, '', '/?view=all-rinks');
    const { result } = renderHook(() => useUrlState());
    expect(result.current.filterSettings).toBeDefined();
    expect(result.current.selectedRinkId).toBe('all-rinks');
    
    act(() => {
      result.current.setFilterSettings({ 
        ...result.current.filterSettings, 
        numberOfDays: 7 
      });
    });
    expect(result.current.filterSettings.numberOfDays).toBe(7);
  });
});
