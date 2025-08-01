import { FilterSettings, FilterMode, RinkFilterType, DateFilterMode, TimeFilterMode, RinkInfo } from '../types';
import { FILTER_DEFAULTS } from './constants';

/**
 * Check if any filters are active (different from defaults)
 */
export function hasActiveFilters(filterSettings?: FilterSettings): boolean {
  if (!filterSettings) {
    return false;
  }
  
  return (
    (filterSettings.activeCategories.length > 0) ||
    (filterSettings.activeRinkIds && filterSettings.activeRinkIds.length > 0) ||
    (filterSettings.dateFilterMode !== FILTER_DEFAULTS.DATE_FILTER_MODE) ||
    (filterSettings.numberOfDays !== FILTER_DEFAULTS.NUMBER_OF_DAYS) ||
    (filterSettings.timeFilterMode !== FILTER_DEFAULTS.TIME_FILTER_MODE)
  );
}

/**
 * Reset all filters to their default values
 */
export function resetFilters(): FilterSettings {
  return {
    activeCategories: [],
    filterMode: 'exclude' as FilterMode,
    activeRinkIds: [],
    rinkFilterMode: 'exclude' as FilterMode,
    rinkFilterType: 'facilities' as RinkFilterType,
    dateFilterMode: 'next-days' as DateFilterMode,
    numberOfDays: 4,
    timeFilterMode: 'all-times' as TimeFilterMode
  };
}

/**
 * Get display metadata with proper formatting
 */
export function getDisplayMetadata(
  eventCount: number,
  facilityMetadata: Record<string, { lastSuccessfulScrape?: string }>,
  facilityErrors: Record<string, string>
): { eventCount: number; lastUpdated: Date | null; errorCount: number } {
  const lastUpdated = Object.values(facilityMetadata)
    .filter(meta => meta?.lastSuccessfulScrape)
    .map(meta => new Date(meta.lastSuccessfulScrape!))
    .sort((a, b) => b.getTime() - a.getTime())[0] || null;

  const errorCount = Object.keys(facilityErrors).length;

  return {
    eventCount,
    lastUpdated,
    errorCount
  };
}

/**
 * Get filter description text based on current settings
 */
export function getFilterDescription(filterSettings?: FilterSettings): string {
  if (!filterSettings) {
    return 'Loading filter settings...';
  }
  
  const { dateFilterMode, numberOfDays, timeFilterMode } = filterSettings;
  
  let description = '';
  
  // Date filter description
  if (dateFilterMode === 'next-days') {
    description = `Showing events for the next ${numberOfDays} days`;
  } else if (dateFilterMode === 'date-range') {
    description = 'Showing events for selected date range';
  } else if (dateFilterMode === 'specific-day') {
    description = 'Showing events for selected date';
  }
  
  // Time filter description
  if (timeFilterMode === 'after-time') {
    description += ' (after specified time)';
  } else if (timeFilterMode === 'before-time') {
    description += ' (before specified time)';
  } else if (timeFilterMode === 'time-range') {
    description += ' (within time range)';
  }
  
  return description + '.';
}

/**
 * Get last update info for metadata display
 */
export function getLastUpdateInfo(
  selectedRinkId?: string,
  facilityMetadata?: Record<string, { lastSuccessfulScrape?: string }>,
  rinksConfig?: RinkInfo[],
  allRinksTabId: string = 'all-rinks'
): string {
  if (!selectedRinkId || !facilityMetadata || !rinksConfig) {
    return 'Loading...';
  }

  let rinkIdsToFindUpdateFor: string[] = [];

  if (selectedRinkId === allRinksTabId) {
    // For "All Rinks", we check all available metadata.
    rinkIdsToFindUpdateFor = Object.keys(facilityMetadata);
  } else {
    const selectedRinkInfo = rinksConfig.find(rink => rink.id === selectedRinkId);
    
    if (selectedRinkInfo) {
      // If it's a facility with members, use them. Otherwise, use the rink's own ID.
      rinkIdsToFindUpdateFor = selectedRinkInfo.memberRinkIds || [selectedRinkInfo.id];
    } else {
      // This case should ideally not be hit if the UI is driven by rinksConfig.
      // But as a fallback, we can check if metadata exists for the given ID.
      if (facilityMetadata[selectedRinkId]) {
        rinkIdsToFindUpdateFor = [selectedRinkId];
      } else {
        return 'Unknown';
      }
    }
  }

  if (rinkIdsToFindUpdateFor.length === 0) {
    return 'Unknown';
  }

  const latestUpdate = rinkIdsToFindUpdateFor
    .map(id => facilityMetadata[id]?.lastSuccessfulScrape)
    .filter((d): d is string => !!d)
    .sort()
    .pop();

  return latestUpdate ? new Date(latestUpdate).toLocaleString() : 'Unknown';
}