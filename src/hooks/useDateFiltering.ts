import { useMemo } from 'react';
import { RawIceEventData, FilterSettings } from '../types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function useDateFiltering(
  events: RawIceEventData[],
  filterSettings: FilterSettings
): RawIceEventData[] {
  return useMemo(() => {
    console.log('🔍 Date filtering - mode:', filterSettings.dateFilterMode, 'settings:', {
      numberOfDays: filterSettings.numberOfDays,
      selectedDate: filterSettings.selectedDate,
      dateRangeStart: filterSettings.dateRangeStart,
      dateRangeEnd: filterSettings.dateRangeEnd
    });

    let startDate: Date;
    let endDate: Date;

    if (filterSettings.dateFilterMode === 'next-days') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      startDate = today;
      // For X days, we want today + (X-1) more days, so today through day X
      endDate = new Date(today.getTime() + ((filterSettings.numberOfDays || 4) - 1) * MS_PER_DAY);
      endDate.setHours(23, 59, 59, 999);
    } else if (filterSettings.dateFilterMode === 'specific-day') {
      if (filterSettings.selectedDate) {
        // Create local dates to avoid timezone issues
        const [year, month, day] = filterSettings.selectedDate.split('-').map(Number);
        startDate = new Date(year, month - 1, day, 0, 0, 0, 0);
        endDate = new Date(year, month - 1, day, 23, 59, 59, 999);
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
        // Create local dates to avoid timezone issues
        const [startYear, startMonth, startDay] = filterSettings.dateRangeStart.split('-').map(Number);
        const [endYear, endMonth, endDay] = filterSettings.dateRangeEnd.split('-').map(Number);
        startDate = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0);
        endDate = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999);
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
      endDate = new Date(today.getTime() + (4 - 1) * MS_PER_DAY);
      endDate.setHours(23, 59, 59, 999);
    }

    console.log('📅 Date filter range:', startDate.toISOString(), 'to', endDate.toISOString());

    const filteredEvents = events.filter(event => {
      const eventDate = new Date(event.startTime);
      // Convert to local date for comparison (same timezone as filter dates)
      const eventLocalDateOnly = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
      const startDateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
      const endDateOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
      
      return eventLocalDateOnly >= startDateOnly && eventLocalDateOnly <= endDateOnly;
    });

    console.log('📊 Date filtering: input', events.length, 'events, output', filteredEvents.length, 'events');
    return filteredEvents;
  }, [events, filterSettings.dateFilterMode, filterSettings.numberOfDays, filterSettings.selectedDate, filterSettings.dateRangeStart, filterSettings.dateRangeEnd]);
}