import { useMemo } from 'react';
import { RawIceEventData, DisplayableIceEvent } from '../types';
import { getRinkConfig } from '../../workers/shared/rink-config';

export function useEventDeduplication(events: RawIceEventData[]): DisplayableIceEvent[] {
  return useMemo(() => {
    // Convert to DisplayableIceEvent and deduplicate
    const rawEventsWithDates: DisplayableIceEvent[] = events.map(event => {
      const rinkConfig = getRinkConfig(event.rinkId);
      const facilityName = rinkConfig?.displayName;
      const rinkName = rinkConfig?.rinkName === 'Main Rink' ? undefined : rinkConfig?.shortRinkName || rinkConfig?.rinkName;
      
      return {
        ...event,
        displayDate: new Date(event.startTime).toLocaleDateString(),
        displayTime: new Date(event.startTime).toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        displayEndTime: event.endTime ? new Date(event.endTime).toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit' 
        }) : undefined,
        rinkDisplayName: rinkConfig?.displayName || event.rinkId,
        sourceUrl: rinkConfig?.sourceUrl || '',
        facilityName,
        rinkName
      };
    });

    // Deduplicate events with identical titles and start times
    const deduplicatedEvents = rawEventsWithDates.filter((event, index) => {
      const duplicateIndex = rawEventsWithDates.findIndex(otherEvent =>
        otherEvent.title === event.title &&
        otherEvent.startTime === event.startTime
      );
      return duplicateIndex === index;
    });

    // Sort by start time
    return deduplicatedEvents.sort((a, b) => 
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
  }, [events]);
}