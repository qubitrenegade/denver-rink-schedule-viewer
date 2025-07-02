import { FilterSettings } from '../types';
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
    activeRinkIds: [],
    dateFilterMode: FILTER_DEFAULTS.DATE_FILTER_MODE,
    numberOfDays: FILTER_DEFAULTS.NUMBER_OF_DAYS,
    timeFilterMode: FILTER_DEFAULTS.TIME_FILTER_MODE,
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: ''
  };
}

/**
 * Get display metadata with proper formatting
 */
export function getDisplayMetadata(
  eventCount: number,
  facilityMetadata: Record<string, any>,
  facilityErrors: Record<string, string>
): { eventCount: number; lastUpdated: Date | null; errorCount: number } {
  const lastUpdated = Object.values(facilityMetadata)
    .filter(meta => meta?.lastUpdated)
    .map(meta => new Date(meta.lastUpdated!))
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
  } else if (dateFilterMode === 'today') {
    description = "Showing today's events";
  } else if (dateFilterMode === 'this-week') {
    description = "Showing this week's events";
  }
  
  // Time filter description
  if (timeFilterMode === 'morning') {
    description += ' (morning hours)';
  } else if (timeFilterMode === 'afternoon') {
    description += ' (afternoon hours)';
  } else if (timeFilterMode === 'evening') {
    description += ' (evening hours)';
  } else if (timeFilterMode === 'custom-time') {
    description += ' (custom time range)';
  }
  
  return description + '.';
}

/**
 * Get last update info for metadata display
 */
export function getLastUpdateInfo(
  selectedRinkId?: string,
  facilityMetadata?: Record<string, any>,
  rinksConfig?: any[],
  allRinksTabId: string = 'all-rinks'
): string {
  // Handle undefined parameters
  if (!selectedRinkId || !facilityMetadata || !rinksConfig) {
    return 'Loading...';
  }

  if (selectedRinkId === allRinksTabId) {
    let latestUpdate = '';
    rinksConfig.forEach(tab => {
      if (tab.memberRinkIds) {
        tab.memberRinkIds.forEach((rinkId: string) => {
          const meta = facilityMetadata[rinkId] as { lastSuccessfulScrape?: string } | undefined;
          if (meta?.lastSuccessfulScrape) {
            if (!latestUpdate || meta.lastSuccessfulScrape > latestUpdate) {
              latestUpdate = meta.lastSuccessfulScrape;
            }
          }
        });
      } else {
        const meta = facilityMetadata[tab.id] as { lastSuccessfulScrape?: string } | undefined;
        if (meta?.lastSuccessfulScrape) {
          if (!latestUpdate || meta.lastSuccessfulScrape > latestUpdate) {
            latestUpdate = meta.lastSuccessfulScrape;
          }
        }
      }
    });
    return latestUpdate ? new Date(latestUpdate).toLocaleString() : 'Unknown';
  } else {
    const meta = facilityMetadata[selectedRinkId] as { lastSuccessfulScrape?: string } | undefined;
    return meta?.lastSuccessfulScrape ? new Date(meta.lastSuccessfulScrape).toLocaleString() : 'Unknown';
  }
}