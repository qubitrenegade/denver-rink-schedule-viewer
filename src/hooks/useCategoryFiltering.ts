import { useMemo } from 'react';
import { RawIceEventData, FilterSettings } from '../types';

export function useCategoryFiltering(
  events: RawIceEventData[],
  filterSettings: FilterSettings
): RawIceEventData[] {
  return useMemo(() => {
    if (!filterSettings.activeCategories || filterSettings.activeCategories.length === 0) {
      return events;
    }

    return events.filter(event =>
      filterSettings.activeCategories.includes(event.category)
    );
  }, [events, filterSettings.activeCategories]);
}