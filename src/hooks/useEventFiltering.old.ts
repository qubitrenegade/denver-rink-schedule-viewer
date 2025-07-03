import { useMemo } from 'react';
import { RawIceEventData, FilterSettings, DisplayableIceEvent } from '../types';
import { RINKS_CONFIG } from '../rinkConfig';
import { ALL_RINKS_TAB_ID } from '../App';
import { getRinkConfig } from '../../workers/shared/rink-config';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseTime(timeString: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeString.split(':').map(Number);
  return { hours, minutes };
}

function getMinutesFromMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function useEventFiltering(
  events: RawIceEventData[],
  filterSettings: FilterSettings,
  selectedRinkId: string
): DisplayableIceEvent[] {
  return useMemo(() => {
    let processedData = [...events];

    // 1. Date Range Filter
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
        // Fallback to today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        startDate = today;
        endDate = new Date(today);
        endDate.setHours(23, 59, 59, 999);
      }
    } else if (filterSettings.dateFilterMode === 'date-range') {
      if (filterSettings.dateRangeStart && filterSettings.dateRangeEnd) {
        startDate = new Date(filterSettings.dateRangeStart + 'T00:00:00');
        endDate = new Date(filterSettings.dateRangeEnd + 'T23:59:59');
      } else {
        // Fallback to next 7 days
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        startDate = today;
        endDate = new Date(today.getTime() + 7 * MS_PER_DAY);
        endDate.setHours(23, 59, 59, 999);
      }
    } else {
      // Fallback
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      startDate = today;
      endDate = new Date(today.getTime() + 4 * MS_PER_DAY);
      endDate.setHours(23, 59, 59, 999);
    }

    processedData = processedData.filter(event => {
      const eventStartTime = event.startTime;
      return eventStartTime >= startDate && eventStartTime <= endDate;
    });

    // 2. Time Filter
    if (filterSettings.timeFilterMode !== 'all-times') {
      processedData = processedData.filter(event => {
        const eventTime = getMinutesFromMidnight(event.startTime);
        if (filterSettings.timeFilterMode === 'after-time' && filterSettings.afterTime) {
          const { hours, minutes } = parseTime(filterSettings.afterTime);
          const afterTimeMinutes = hours * 60 + minutes;
          return eventTime >= afterTimeMinutes;
        } else if (filterSettings.timeFilterMode === 'before-time' && filterSettings.beforeTime) {
          const { hours, minutes } = parseTime(filterSettings.beforeTime);
          const beforeTimeMinutes = hours * 60 + minutes;
          return eventTime < beforeTimeMinutes;
        } else if (filterSettings.timeFilterMode === 'time-range' && filterSettings.timeRangeStart && filterSettings.timeRangeEnd) {
          const { hours: startHours, minutes: startMinutes } = parseTime(filterSettings.timeRangeStart);
          const { hours: endHours, minutes: endMinutes } = parseTime(filterSettings.timeRangeEnd);
          const startTimeMinutes = startHours * 60 + startMinutes;
          const endTimeMinutes = endHours * 60 + endMinutes;
          return eventTime >= startTimeMinutes && eventTime <= endTimeMinutes;
        }
        return true;
      });
    }

    // 3. Tab-specific filtering (for individual/group tabs)
    const selectedTabConfig = RINKS_CONFIG.find(r => r.id === selectedRinkId);
    if (selectedRinkId !== ALL_RINKS_TAB_ID) {
      if (selectedTabConfig?.memberRinkIds) {
        // Group tab - filter to member rinks
        processedData = processedData.filter(event =>
          selectedTabConfig.memberRinkIds!.includes(event.rinkId)
        );
      } else {
        // Individual tab - filter to specific rink
        processedData = processedData.filter(event => event.rinkId === selectedRinkId);
      }
    }

    // 4. Global Deduplication (remove events with same title and startTime)
    // This prevents duplicates that might occur across different scrapers or data sources
    processedData = processedData.filter((event, index, self) =>
      index === self.findIndex((e) =>
        e.title === event.title &&
        e.startTime.getTime() === event.startTime.getTime()
      )
    );

    // 5. Rink Filter (only for 'All Rinks' view, based on individual rinks)
    if (selectedRinkId === ALL_RINKS_TAB_ID && filterSettings.activeRinkIds && filterSettings.activeRinkIds.length > 0) {
      processedData = processedData.filter(event => {
        if (filterSettings.rinkFilterMode === 'include') {
          return filterSettings.activeRinkIds!.includes(event.rinkId);
        } else { // exclude
          return !filterSettings.activeRinkIds!.includes(event.rinkId);
        }
      });
    }

    // 6. Prepare for display (add facilityName and rinkName)
    const rawEventsWithDates: (RawIceEventData & { rinkName?: string; facilityName?: string })[] = processedData.map(e => {
      const rinkConfig = getRinkConfig(e.rinkId);
      const facilityName = rinkConfig.displayName;
      const rinkName = rinkConfig.rinkName === 'Main Rink' ? undefined : rinkConfig.shortRinkName || rinkConfig.rinkName;

      return {
        ...e,
        facilityName,
        rinkName
      };
    });

    // 7. Category Filter
    const processedEvents: DisplayableIceEvent[] = rawEventsWithDates.map(event => ({
      ...event,
      startTime: event.startTime.toISOString(),
      endTime: event.endTime.toISOString(),
    })).filter(event => {
      if (filterSettings.filterMode === 'include') {
        return filterSettings.activeCategories.length === 0 ? false : filterSettings.activeCategories.includes(event.category);
      } else {
        return !filterSettings.activeCategories.includes(event.category);
      }
    });

    // Sort by start time
    const sortedEvents = processedEvents.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    return sortedEvents;
  }, [events, filterSettings, selectedRinkId]);
}
