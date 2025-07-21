import { useMemo } from 'react';
import { RawIceEventData, FilterSettings } from '../types';
import { RINKS_CONFIG } from '../rinkConfig';
import { ALL_RINKS_TAB_ID } from '../App';

/**
 * Enhanced rink filtering that supports both facility-level and individual rink filtering
 */
export function useEnhancedRinkFiltering(
  events: RawIceEventData[],
  filterSettings: FilterSettings,
  selectedRinkId: string
): RawIceEventData[] {
  return useMemo(() => {
    let filteredEvents = [...events];

    // First filter by selected rink tab (unchanged)
    if (selectedRinkId !== ALL_RINKS_TAB_ID) {
      const selectedRinkConfig = RINKS_CONFIG.find(rink => rink.id === selectedRinkId);
      if (selectedRinkConfig?.memberRinkIds) {
        // Multi-rink facility (like SSPRD)
        filteredEvents = filteredEvents.filter(event => 
          selectedRinkConfig.memberRinkIds!.includes(event.rinkId)
        );
      } else {
        // Single rink
        filteredEvents = filteredEvents.filter(event => event.rinkId === selectedRinkId);
      }
    }

    // Then apply additional rink filters if any
    if (filterSettings.activeRinkIds && filterSettings.activeRinkIds.length > 0) {
      const { activeRinkIds, rinkFilterMode = 'include', rinkFilterType = 'facilities' } = filterSettings;
      
      let rinkIdsToCheck: string[] = [];

      if (rinkFilterType === 'facilities') {
        // When filtering by facilities, expand facility IDs to include all their member rinks
        rinkIdsToCheck = activeRinkIds.reduce((acc: string[], rinkId) => {
          const rinkConfig = RINKS_CONFIG.find(r => r.id === rinkId);
          if (rinkConfig?.memberRinkIds) {
            // It's a facility with multiple rinks
            acc.push(...rinkConfig.memberRinkIds);
          } else {
            // It's an individual rink
            acc.push(rinkId);
          }
          return acc;
        }, []);
      } else {
        // When filtering by individual rinks, use the IDs directly
        rinkIdsToCheck = activeRinkIds;
      }
      
      if (rinkFilterMode === 'include') {
        // Include only events from selected rinks/facilities
        filteredEvents = filteredEvents.filter(event =>
          rinkIdsToCheck.includes(event.rinkId)
        );
      } else if (rinkFilterMode === 'exclude') {
        // Exclude events from selected rinks/facilities
        filteredEvents = filteredEvents.filter(event =>
          !rinkIdsToCheck.includes(event.rinkId)
        );
      }
    }

    return filteredEvents;
  }, [events, selectedRinkId, filterSettings.activeRinkIds, filterSettings.rinkFilterMode, filterSettings.rinkFilterType]);
}
