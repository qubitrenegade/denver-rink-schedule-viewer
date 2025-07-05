import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useUrlState } from './useUrlState';

describe('useUrlState', () => {
  it('syncs state with URL params', () => {
    window.history.pushState({}, '', '/?foo=bar');
    const { result } = renderHook(() => useUrlState());
    expect(result.current.filterSettings).toBeDefined();
    act(() => {
      result.current.setFilterSettings({ ...result.current.filterSettings, startDate: 'baz' });
    });
    expect(result.current.filterSettings.startDate).toBe('baz');
  });
});
