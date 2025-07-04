import { useMemo } from 'react';
import { RawIceEventData, FilterSettings } from '../types';
import { RINKS_CONFIG } from '../rinkConfig';
import { ALL_RINKS_TAB_ID } from '../App';

export function useRinkFiltering(
  events: RawIceEventData[],
  filterSettings: FilterSettings,
  selectedRinkId: string
): RawIceEventData[] {
  return useMemo(() => {
    let filteredEvents = [...events];

    // First filter by selected rink tab
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
      const { activeRinkIds, rinkFilterMode = 'include' } = filterSettings;
      
      if (rinkFilterMode === 'include') {
        // Include only events from selected rinks
        filteredEvents = filteredEvents.filter(event =>
          activeRinkIds!.includes(event.rinkId)
        );
      } else if (rinkFilterMode === 'exclude') {
        // Exclude events from selected rinks
        filteredEvents = filteredEvents.filter(event =>
          !activeRinkIds!.includes(event.rinkId)
        );
      }
    }

    return filteredEvents;
  }, [events, selectedRinkId, filterSettings.activeRinkIds, filterSettings.rinkFilterMode]);
}