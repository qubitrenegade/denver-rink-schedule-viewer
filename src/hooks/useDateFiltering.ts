import { useMemo } from 'react';
import { RawIceEventData, FilterSettings } from '../types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function useDateFiltering(
  events: RawIceEventData[],
  filterSettings: FilterSettings
): RawIceEventData[] {
  return useMemo(() => {
    let startDate: Date;
    let endDate: Date;

    if (filterSettings.dateFilterMode === 'next-days') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      startDate = today;
      endDate = new Date(today.getTime() + (filterSettings.numberOfDays || 4) * MS_PER_DAY);
      endDate.setHours(23, 59, 59, 999);
    } else if (filterSettings.dateFilterMode === 'specific-day') {
      if (filterSettings.selectedDate) {
        startDate = new Date(filterSettings.selectedDate + 'T00:00:00');
        endDate = new Date(filterSettings.selectedDate + 'T23:59:59');
      } else {
        // Default to today if no date selected
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        startDate = today;
        endDate = new Date(today.getTime() + MS_PER_DAY);
        endDate.setHours(23, 59, 59, 999);
      }
    } else if (filterSettings.dateFilterMode === 'date-range') {
      if (filterSettings.dateRangeStart && filterSettings.dateRangeEnd) {
        startDate = new Date(filterSettings.dateRangeStart + 'T00:00:00');
        endDate = new Date(filterSettings.dateRangeEnd + 'T23:59:59');
      } else {
        // Default to next 7 days if no range specified
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        startDate = today;
        endDate = new Date(today.getTime() + 7 * MS_PER_DAY);
        endDate.setHours(23, 59, 59, 999);
      }
    } else {
      // Default case: next 4 days
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      startDate = today;
      endDate = new Date(today.getTime() + 4 * MS_PER_DAY);
      endDate.setHours(23, 59, 59, 999);
    }

    return events.filter(event => {
      const eventDate = new Date(event.startTime);
      return eventDate >= startDate && eventDate <= endDate;
    });
  }, [events, filterSettings.dateFilterMode, filterSettings.numberOfDays, filterSettings.selectedDate, filterSettings.dateRangeStart, filterSettings.dateRangeEnd]);
}