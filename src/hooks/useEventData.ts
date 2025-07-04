// Updated useEventData hook to fetch from CloudFlare Workers instead of static files
import { useState, useCallback } from 'react';
import { RawIceEventData, FacilityMetadata } from '../types';
import { FACILITY_IDS, CACHE_DURATIONS } from '../utils/constants';
import { logger } from '../utils/logger';

// Retry utility with exponential backoff
async function withRetry<T>(
  fn: () => Promise<T>, 
  maxAttempts: number = 3, 
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === maxAttempts) {
        throw lastError;
      }
      
      // Exponential backoff: 1s, 2s, 4s...
      const delay = baseDelay * Math.pow(2, attempt - 1);
      logger.warn(`⚠️ Attempt ${attempt} failed, retrying in ${delay}ms:`, lastError.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

// Configuration for CloudFlare Worker API endpoint
const WORKER_API_BASE = (import.meta.env as any).WORKER_API_BASE ||
  ((import.meta.env as any).PROD ? 'https://api.geticeti.me' : 'http://localhost:8794');

export function useEventData() {
  const [staticData, setStaticData] = useState<RawIceEventData[]>([]);
  const [facilityMetadata, setFacilityMetadata] = useState<Record<string, FacilityMetadata>>({});
  const [facilityErrors, setFacilityErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);

  const fetchData = useCallback(async (forceRefresh = false) => {
    // Use cache for 5 minutes unless force refresh
    if (staticData.length > 0 && !forceRefresh && Date.now() - lastFetchTime < CACHE_DURATIONS.API_CACHE) {
      logger.log(`📋 Using cached data`);
      return;
    }

    setIsLoading(true);
    setError(null);
    setFacilityErrors({});

    try {
      logger.log(`📡 Fetching data from API`);

      // Try to fetch from the new /api/all-events and /api/all-metadata endpoints first with retry logic
      try {
        const [eventsResponse, metadataResponse] = await withRetry(async () => {
          const responses = await Promise.all([
            fetch(`${WORKER_API_BASE}/api/all-events`, {
              headers: {
                'Accept': 'application/json',
              },
              signal: AbortSignal.timeout(10000) // 10 second timeout
            }),
            fetch(`${WORKER_API_BASE}/api/all-metadata`, {
              headers: {
                'Accept': 'application/json',
              },
              signal: AbortSignal.timeout(10000) // 10 second timeout
            })
          ]);
          
          // Check if both responses are successful
          if (!responses[0].ok || !responses[1].ok) {
            throw new Error(`API failed - Events: ${responses[0].status}, Metadata: ${responses[1].status}`);
          }
          
          return responses;
        }, 3, 1000);

        logger.log(`📊 Events response: ${eventsResponse.status} (${eventsResponse.statusText}), Metadata response: ${metadataResponse.status} (${metadataResponse.statusText})`);
        logger.log(`📊 Events content-type: ${eventsResponse.headers.get('content-type')}, Metadata content-type: ${metadataResponse.headers.get('content-type')}`);

        logger.log(`📡 Parsing events response...`);
        const allEventsData = await eventsResponse.json();
        logger.log(`📡 Parsing metadata response...`);
        const allMetadataData = await metadataResponse.json();

        logger.log(`📊 Loaded ${allEventsData.length} events, ${Object.keys(allMetadataData).length} facilities via bulk API`);

        // Process events data with validation
        const bulkEvents: RawIceEventData[] = allEventsData
          .filter((event: any) => event && event.startTime && event.endTime) // Filter out invalid events
          .map((event: any) => ({
            ...event,
            startTime: new Date(event.startTime),
            endTime: new Date(event.endTime),
          }))
          .filter((event: RawIceEventData) => !isNaN(event.startTime.getTime()) && !isNaN(event.endTime.getTime())); // Filter out invalid dates

        setStaticData(bulkEvents);
        setFacilityMetadata(allMetadataData);
        setLastFetchTime(Date.now());

        logger.log(`✅ Successfully loaded ${bulkEvents.length} events from ${Object.keys(allMetadataData).length} facilities`);
        return;
      } catch (bulkError) {
        logger.warn('⚠️ Bulk API failed after retries, falling back to individual requests:', bulkError);
        logger.warn('⚠️ Error details:', {
          name: bulkError instanceof Error ? bulkError.name : 'Unknown',
          message: bulkError instanceof Error ? bulkError.message : String(bulkError),
          stack: bulkError instanceof Error ? bulkError.stack : undefined
        });
      }

      // Fallback: fetch each facility individually (maintains compatibility)
      const facilityIds = FACILITY_IDS;

      const facilityPromises = facilityIds.map(async (facilityId) => {
        try {
          const [dataResponse, metadataResponse] = await withRetry(async () => {
            const responses = await Promise.all([
              fetch(`${WORKER_API_BASE}/data/${facilityId}.json`, {
                headers: {
                  'Accept': 'application/json',
                },
                signal: AbortSignal.timeout(8000) // 8 second timeout per facility
              }),
              fetch(`${WORKER_API_BASE}/data/${facilityId}-metadata.json`, {
                headers: {
                  'Accept': 'application/json',
                },
                signal: AbortSignal.timeout(8000) // 8 second timeout per facility
              })
            ]);
            return responses;
          }, 2, 500); // 2 attempts with shorter delay for individual facilities

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

          // Validate and parse events data
          const parsedEvents: RawIceEventData[] = eventsData
            .filter((event: any) => {
              if (!event || !event.startTime || !event.endTime) {
                logger.warn(`⚠️ Skipping invalid event from ${facilityId}:`, event);
                return false;
              }
              return true;
            })
            .map((event: any) => ({
              ...event,
              startTime: new Date(event.startTime),
              endTime: new Date(event.endTime),
            }))
            .filter((event: RawIceEventData) => {
              const validDates = !isNaN(event.startTime.getTime()) && !isNaN(event.endTime.getTime());
              if (!validDates) {
                logger.warn(`⚠️ Skipping event with invalid dates from ${facilityId}:`, event);
              }
              return validDates;
            });

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

      logger.log(`✅ Loaded ${allEvents.length} events from ${successCount}/${facilityIds.length} facilities`);

      // Enhanced error reporting
      if (errorCount > 0 && successCount === 0) {
        const isNetworkError = Object.values(newFacilityErrors).some(err => 
          err.includes('fetch') || err.includes('network') || err.includes('timeout')
        );
        
        if (isNetworkError) {
          setError('Network error: Unable to connect to the schedule server. Please check your internet connection and try again.');
        } else {
          setError('All schedule sources are currently unavailable. Please try again in a few minutes.');
        }
      } else if (errorCount > 0) {
        logger.warn(`⚠️ ${errorCount} out of ${facilityIds.length} facilities failed to load`);
        // Don't set a global error if some facilities succeeded
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Failed to fetch data:', errorMessage);
      
      // Categorize error types for better user messaging
      if (errorMessage.includes('fetch') || errorMessage.includes('NetworkError')) {
        setError('Network error: Please check your internet connection and try again.');
      } else if (errorMessage.includes('timeout') || errorMessage.includes('AbortError')) {
        setError('Request timeout: The server is taking too long to respond. Please try again.');
      } else if (errorMessage.includes('JSON') || errorMessage.includes('parse')) {
        setError('Data format error: The server returned invalid data. Please try again.');
      } else {
        setError(`Failed to load schedule data: ${errorMessage}`);
      }
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
