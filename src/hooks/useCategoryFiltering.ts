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

    const { activeCategories, filterMode = 'include' } = filterSettings;

    if (filterMode === 'include') {
      // Include only events from selected categories
      return events.filter(event =>
        activeCategories.includes(event.category)
      );
    } else if (filterMode === 'exclude') {
      // Exclude events from selected categories
      return events.filter(event =>
        !activeCategories.includes(event.category)
      );
    }

    return events;
  }, [events, filterSettings.activeCategories, filterSettings.filterMode]);
}