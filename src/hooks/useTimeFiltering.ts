import { useMemo } from 'react';
import { RawIceEventData, FilterSettings } from '../types';

function parseTime(timeString: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeString.split(':').map(Number);
  return { hours, minutes };
}

function getMinutesFromMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function useTimeFiltering(
  events: RawIceEventData[],
  filterSettings: FilterSettings
): RawIceEventData[] {
  return useMemo(() => {
    if (filterSettings.timeFilterMode === 'all-times') {
      return events;
    }

    return events.filter(event => {
      const eventDate = new Date(event.startTime);
      const eventMinutes = getMinutesFromMidnight(eventDate);

      if (filterSettings.timeFilterMode === 'after-time' && filterSettings.afterTime) {
        const { hours, minutes } = parseTime(filterSettings.afterTime);
        const afterMinutes = hours * 60 + minutes;
        return eventMinutes >= afterMinutes;
      }

      if (filterSettings.timeFilterMode === 'before-time' && filterSettings.beforeTime) {
        const { hours, minutes } = parseTime(filterSettings.beforeTime);
        const beforeMinutes = hours * 60 + minutes;
        return eventMinutes <= beforeMinutes;
      }

      if (filterSettings.timeFilterMode === 'time-range' && filterSettings.timeRangeStart && filterSettings.timeRangeEnd) {
        const { hours: startHours, minutes: startMinutes } = parseTime(filterSettings.timeRangeStart);
        const { hours: endHours, minutes: endMinutes } = parseTime(filterSettings.timeRangeEnd);
        const startRangeMinutes = startHours * 60 + startMinutes;
        const endRangeMinutes = endHours * 60 + endMinutes;
        
        return eventMinutes >= startRangeMinutes && eventMinutes <= endRangeMinutes;
      }

      return true;
    });
  }, [events, filterSettings.timeFilterMode, filterSettings.afterTime, filterSettings.beforeTime, filterSettings.timeRangeStart, filterSettings.timeRangeEnd]);
}