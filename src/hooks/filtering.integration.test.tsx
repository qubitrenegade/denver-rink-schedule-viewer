import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useEventFiltering } from './useEventFiltering';
import { FilterSettings, RawIceEventData } from '../types';

describe('Filtering integration', () => {
  it('filters events end-to-end by all criteria', () => {
    const events: RawIceEventData[] = [
      { id: '1', rinkId: 'ice-ranch', category: 'Public Skate', startTime: new Date('2025-06-01T10:00:00Z'), endTime: new Date('2025-06-01T11:00:00Z'), title: 'Public Skate' },
      { id: '2', rinkId: 'big-bear', category: 'Stick & Puck', startTime: new Date('2025-06-01T12:00:00Z'), endTime: new Date('2025-06-01T13:00:00Z'), title: 'Stick & Puck' },
      { id: '3', rinkId: 'ice-ranch', category: 'Stick & Puck', startTime: new Date('2025-06-01T14:00:00Z'), endTime: new Date('2025-06-01T15:00:00Z'), title: 'Stick & Puck' },
    ];
    const filterSettings: FilterSettings = {
      activeCategories: ['Stick & Puck'],
      filterMode: 'include',
      activeRinkIds: ['ice-ranch'],
      dateFilterMode: 'specific-day',
      selectedDate: '2025-06-01',
      timeFilterMode: 'all-times',
    };
    const selectedRinkId = 'ice-ranch';
    const { result } = renderHook(() => useEventFiltering(events, filterSettings, selectedRinkId));
    expect(result.current.length).toBe(1);
    expect(result.current[0].id).toBe('3');
  });
});
