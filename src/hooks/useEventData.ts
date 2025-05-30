import { useState, useCallback } from 'react';
import { RawIceEventData, FacilityMetadata } from '../types';

export function useEventData() {
  const [staticData, setStaticData] = useState<RawIceEventData[]>([]);
  const [facilityMetadata, setFacilityMetadata] = useState<Record<string, FacilityMetadata>>({});
  const [facilityErrors, setFacilityErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);

  const fetchData = useCallback(async (forceRefresh = false) => {
    if (staticData.length > 0 && !forceRefresh && Date.now() - lastFetchTime < 5 * 60 * 1000) {
      console.log(`📋 Using cached data`);
      return;
    }
    setIsLoading(true);
    setError(null);
    setFacilityErrors({});
    try {
      console.log(`📡 Fetching all facility data and metadata...`);
      const facilityIds = ['ice-ranch', 'big-bear', 'du-ritchie', 'foothills-edge', 'ssprd-249', 'ssprd-250'];
      const facilityPromises = facilityIds.map(async (facilityId) => {
        try {
          const [dataResponse, metadataResponse] = await Promise.all([
            fetch(`/data/${facilityId}.json`),
            fetch(`/data/${facilityId}-metadata.json`)
          ]);
          let eventsData = [];
          let dataError = null;
          if (dataResponse.ok) {
            eventsData = await dataResponse.json();
          } else {
            dataError = `HTTP ${dataResponse.status}: ${dataResponse.statusText}`;
          }
          let metadata: FacilityMetadata | null = null;
          if (metadataResponse.ok) {
            metadata = await metadataResponse.json();
          } else {
            metadata = {
              facilityId,
              facilityName: facilityId,
              displayName: facilityId,
              lastAttempt: new Date().toISOString(),
              status: dataError ? 'error' : 'success',
              eventCount: eventsData.length,
              sourceUrl: '',
              rinks: [{ rinkId: facilityId, rinkName: 'Main Rink' }],
              ...(dataError && { errorMessage: dataError }),
              ...(!dataError && { lastSuccessfulScrape: new Date().toISOString() })
            };
          }
          const parsedEvents: RawIceEventData[] = eventsData.map((event: any) => ({
            ...event,
            startTime: new Date(event.startTime),
            endTime: new Date(event.endTime),
          }));
          return {
            facilityId,
            events: parsedEvents,
            metadata,
            success: !dataError,
            error: dataError
          };
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          const errorMetadata: FacilityMetadata = {
            facilityId,
            facilityName: facilityId,
            displayName: facilityId,
            lastAttempt: new Date().toISOString(),
            status: 'error',
            eventCount: 0,
            errorMessage: errorMessage,
            sourceUrl: '',
            rinks: [{ rinkId: facilityId, rinkName: 'Main Rink' }]
          };
          return {
            facilityId,
            events: [],
            metadata: errorMetadata,
            success: false,
            error: errorMessage
          };
        }
      });
      const results = await Promise.all(facilityPromises);
      const allEvents: RawIceEventData[] = [];
      const newFacilityErrors: Record<string, string> = {};
      const newFacilityMetadata: Record<string, FacilityMetadata> = {};
      results.forEach(result => {
        if (result.metadata) {
          newFacilityMetadata[result.facilityId] = result.metadata;
        }
        if (result.success) {
          allEvents.push(...result.events);
        } else {
          if (result.error) {
            newFacilityErrors[result.facilityId] = result.error;
          }
        }
      });
      setStaticData(allEvents);
      setFacilityErrors(newFacilityErrors);
      setFacilityMetadata(newFacilityMetadata);
      setLastFetchTime(Date.now());
      const successCount = results.filter(r => r.success).length;
      const errorCount = results.filter(r => !r.success).length;
      if (errorCount > 0 && successCount === 0) {
        setError(`Failed to load data from all facilities. Check your connection and try again.`);
      }
    } catch (err) {
      setError(`Failed to load schedule data: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, [staticData.length, lastFetchTime]);

  return {
    staticData,
    facilityMetadata,
    facilityErrors,
    isLoading,
    error,
    refetch: fetchData
  };
}
