// Updated useEventData hook to fetch from CloudFlare Workers instead of static files
import { useState, useCallback } from 'react';
import { RawIceEventData, FacilityMetadata } from '../types';

// Configuration for CloudFlare Worker API endpoint
const WORKER_API_BASE = import.meta.env.WORKER_API_BASE ||
  (import.meta.env.PROD ? 'https://api.geticeti.me' : 'http://localhost:8794');

export function useEventData() {
  const [staticData, setStaticData] = useState<RawIceEventData[]>([]);
  const [facilityMetadata, setFacilityMetadata] = useState<Record<string, FacilityMetadata>>({});
  const [facilityErrors, setFacilityErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);

  const fetchData = useCallback(async (forceRefresh = false) => {
    // Use cache for 5 minutes unless force refresh
    if (staticData.length > 0 && !forceRefresh && Date.now() - lastFetchTime < 5 * 60 * 1000) {
      console.log(`📋 Using cached data`);
      return;
    }

    setIsLoading(true);
    setError(null);
    setFacilityErrors({});

    try {
      console.log(`📡 Fetching data from API`);

      // Try to fetch from the new /api/all-events and /api/all-metadata endpoints first
      try {
        const [eventsResponse, metadataResponse] = await Promise.all([
          fetch(`${WORKER_API_BASE}/api/all-events`, {
            headers: {
              'Accept': 'application/json',
            }
          }),
          fetch(`${WORKER_API_BASE}/api/all-metadata`, {
            headers: {
              'Accept': 'application/json',
            }
          })
        ]);

        console.log(`📊 Events response: ${eventsResponse.status} (${eventsResponse.statusText}), Metadata response: ${metadataResponse.status} (${metadataResponse.statusText})`);
        console.log(`📊 Events content-type: ${eventsResponse.headers.get('content-type')}, Metadata content-type: ${metadataResponse.headers.get('content-type')}`);

        if (eventsResponse.ok && metadataResponse.ok) {
          console.log(`📡 Parsing events response...`);
          const allEventsData = await eventsResponse.json();
          console.log(`📡 Parsing metadata response...`);
          const allMetadataData = await metadataResponse.json();

          console.log(`📊 Loaded ${allEventsData.length} events, ${Object.keys(allMetadataData).length} facilities via bulk API`);

          // Process events data
          const bulkEvents: RawIceEventData[] = allEventsData.map((event: any) => ({
            ...event,
            startTime: new Date(event.startTime),
            endTime: new Date(event.endTime),
          }));

          setStaticData(bulkEvents);
          setFacilityMetadata(allMetadataData);
          setLastFetchTime(Date.now());

          console.log(`✅ Successfully loaded ${bulkEvents.length} events from ${Object.keys(allMetadataData).length} facilities`);
          return;
        } else {
          console.warn(`⚠️ Bulk API failed - Events: ${eventsResponse.status}, Metadata: ${metadataResponse.status}`);
        }
      } catch (bulkError) {
        console.warn('⚠️ Bulk API failed, falling back to individual requests:', bulkError);
        console.warn('⚠️ Error details:', {
          name: bulkError?.name,
          message: bulkError?.message,
          stack: bulkError?.stack
        });
      }

      // Fallback: fetch each facility individually (maintains compatibility)
      const facilityIds = ['ice-ranch', 'big-bear', 'du-ritchie', 'foothills-edge', 'ssprd-fsc', 'ssprd-sssc', 'apex-ice'];

      const facilityPromises = facilityIds.map(async (facilityId) => {
        try {
          const [dataResponse, metadataResponse] = await Promise.all([
            fetch(`${WORKER_API_BASE}/data/${facilityId}.json`, {
              headers: {
                'Accept': 'application/json',
              }
            }),
            fetch(`${WORKER_API_BASE}/data/${facilityId}-metadata.json`, {
              headers: {
                'Accept': 'application/json',
              }
            })
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
            // Create default metadata if not available
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
            errorMessage,
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

      console.log(`✅ Loaded ${allEvents.length} events from ${successCount}/${facilityIds.length} facilities`);

      if (errorCount > 0 && successCount === 0) {
        setError(`Failed to load data from all facilities. Check your connection and try again.`);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to fetch data:', errorMessage);
      setError(`Failed to load schedule data: ${errorMessage}`);
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
