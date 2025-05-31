import { bench, describe } from 'vitest';
import { useEventFiltering } from './useEventFiltering';
import { FilterSettings, RawIceEventData } from '../types';
import { renderHook } from '@testing-library/react';

const events: RawIceEventData[] = Array.from({ length: 1000 }, (_, i) => ({
  id: String(i),
  rinkId: i % 2 === 0 ? 'ice-ranch' : 'big-bear',
  category: i % 3 === 0 ? 'Public Skate' : 'Stick & Puck',
  startTime: new Date('2025-06-01T10:00:00Z'),
  endTime: new Date('2025-06-01T11:00:00Z'),
  title: 'Event',
}));

const filterSettings: FilterSettings = {
  activeCategories: ['Public Skate'],
  filterMode: 'include',
  activeRinkIds: ['ice-ranch'],
  dateFilterMode: 'specific-day',
  selectedDate: '2025-06-01',
  timeFilterMode: 'all-times',
};

describe('useEventFiltering performance', () => {
  bench('filters 1000 events', () => {
    renderHook(() => useEventFiltering(events, filterSettings, 'ice-ranch'));
  });
});
