// CloudFlare Worker: Data API (Fixed)
// This worker serves rink data from KV to the frontend

import { FACILITY_IDS, CORS_HEADERS, HTTP_STATUS, CACHE_DURATIONS } from './shared/constants';

// Enhanced cache headers utility
async function getCacheHeaders(maxAge: number, isStale: boolean = false, resourceContent?: string): Promise<Record<string, string>> {
  let etag = `"no-content-${maxAge}"`; // Stable fallback based on cache duration
  
  // Always generate content-based ETag if content is provided
  if (resourceContent) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(resourceContent);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      etag = `"${hashHex.substring(0, 16)}"`;  // Use first 16 chars for shorter ETag
    } catch (error) {
      console.warn('Failed to generate content-based ETag:', error);
      // Use stable fallback that won't change unnecessarily
      etag = `"error-${maxAge}-${resourceContent?.length || 0}"`;
    }
  }

  const baseHeaders = {
    'Content-Type': 'application/json',
    'Cache-Control': `public, max-age=${maxAge}, stale-while-revalidate=${maxAge * 2}`,
    'ETag': etag,
    ...CORS_HEADERS
  };

  if (isStale) {
    // Add stale indicators
    baseHeaders['Cache-Control'] += ', must-revalidate';
    baseHeaders['Warning'] = '110 - "Response is stale"';
  }

  return baseHeaders;
}

interface Env {
  RINK_DATA: KVNamespace;
}

function handleCORS(request: Request): Response | null {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS
    });
  }
  return null;
}

async function handleDataRequest(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  console.log(`🔍 Request path: ${path}`);

  try {
    // GET /data/{facilityId}-metadata.json - Get metadata for specific facility
    const metadataMatch = path.match(/^\/data\/([a-z0-9-]+)-metadata\.json$/);
    if (metadataMatch) {
      const facilityId = metadataMatch[1];
      console.log(`📋 Fetching metadata for facility: ${facilityId}`);
      const metadataData = await env.RINK_DATA.get(`metadata:${facilityId}`);
      console.log(`Metadata request for ${facilityId}, found: ${!!metadataData}, value:`, metadataData);

      if (!metadataData || metadataData.trim() === '[]') {
        console.log(`⚠️ No metadata found for ${facilityId} (empty or []), returning default`);
        // Return default metadata if not found or if value is []
        const defaultMetadata = {
          facilityId,
          facilityName: facilityId,
          displayName: facilityId,
          lastAttempt: new Date().toISOString(),
          status: 'error' as const,
          eventCount: 0,
          errorMessage: 'No data available',
          sourceUrl: '',
          rinks: [{ rinkId: facilityId, rinkName: 'Main Rink' }]
        };
        const defaultMetadataJson = JSON.stringify(defaultMetadata);
        return new Response(defaultMetadataJson, {
          status: 200,
          headers: await getCacheHeaders(CACHE_DURATIONS.ERRORS, true, defaultMetadataJson)
        });
      }

      console.log(`✅ Found metadata for ${facilityId}`);
      return new Response(metadataData, {
        status: 200,
        headers: await getCacheHeaders(CACHE_DURATIONS.METADATA, false, metadataData)
      });
    }

    // GET /data/{facilityId}.json - Get events for specific facility
    const eventMatch = path.match(/^\/data\/([a-z0-9-]+)\.json$/);
    if (eventMatch) {
      const facilityId = eventMatch[1];
      console.log(`📊 Fetching events for facility: ${facilityId}`);
      const eventsData = await env.RINK_DATA.get(`events:${facilityId}`);

      if (!eventsData) {
        console.log(`⚠️ No events data found for ${facilityId}`);
        const emptyEventsJson = JSON.stringify([]);
        return new Response(emptyEventsJson, {
          status: 200,
          headers: await getCacheHeaders(CACHE_DURATIONS.ERRORS, true, emptyEventsJson)
        });
      }

      console.log(`✅ Found events data for ${facilityId}`);
      return new Response(eventsData, {
        status: 200,
        headers: await getCacheHeaders(CACHE_DURATIONS.EVENTS, false, eventsData)
      });
    }

    // GET /api/all-events - Get all events from all facilities
    if (path === '/api/all-events') {
      console.log(`📊 Fetching all events`);
      const allEvents = [];

      for (const facilityId of FACILITY_IDS) {
        try {
          const eventsData = await env.RINK_DATA.get(`events:${facilityId}`);
          if (eventsData && eventsData.trim() !== '') {
            try {
              const events = JSON.parse(eventsData);
              if (Array.isArray(events)) {
                allEvents.push(...events);
                console.log(`✅ Loaded ${events.length} events from ${facilityId}`);
              } else {
                console.warn(`⚠️ Events data for ${facilityId} is not an array`);
              }
            } catch (parseError) {
              console.warn(`❌ Failed to parse JSON for ${facilityId}:`, parseError);
              console.warn(`❌ Raw data:`, eventsData);
            }
          } else {
            console.log(`⚠️ No events data for ${facilityId}`);
          }
        } catch (error) {
          console.warn(`❌ Failed to load events for ${facilityId}:`, error);
        }
      }

      console.log(`📊 Total events loaded: ${allEvents.length}`);
      const allEventsJson = JSON.stringify(allEvents);
      return new Response(allEventsJson, {
        status: 200,
        headers: await getCacheHeaders(CACHE_DURATIONS.EVENTS, false, allEventsJson)
      });
    }

    // GET /api/all-metadata - Get metadata for all facilities
    if (path === '/api/all-metadata') {
      console.log(`📋 Fetching all metadata`);
      const allMetadata: Record<string, any> = {};

      for (const facilityId of FACILITY_IDS) {
        try {
          const metadataData = await env.RINK_DATA.get(`metadata:${facilityId}`);
          if (metadataData && metadataData.trim() !== '') {
            try {
              const metadata = JSON.parse(metadataData);
              allMetadata[facilityId] = metadata;
              console.log(`✅ Loaded metadata for ${facilityId}`);
            } catch (parseError) {
              console.warn(`❌ Failed to parse JSON metadata for ${facilityId}:`, parseError);
              console.warn(`❌ Raw metadata:`, metadataData);
            }
          } else {
            console.log(`⚠️ No metadata for ${facilityId}`);
          }
        } catch (error) {
          console.warn(`❌ Failed to load metadata for ${facilityId}:`, error);
        }
      }

      console.log(`📋 Total metadata loaded for ${Object.keys(allMetadata).length} facilities`);
      const allMetadataJson = JSON.stringify(allMetadata);
      return new Response(allMetadataJson, {
        status: 200,
        headers: await getCacheHeaders(CACHE_DURATIONS.METADATA, false, allMetadataJson)
      });
    }

    // GET /api/health - Health check with KV status
    if (path === '/api/health') {
      console.log(`🏥 Health check`);
      const healthData = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        facilities: {} as Record<string, any>
      };

      for (const facilityId of FACILITY_IDS) {
        try {
          const metadataData = await env.RINK_DATA.get(`metadata:${facilityId}`);
          const eventsData = await env.RINK_DATA.get(`events:${facilityId}`);

          healthData.facilities[facilityId] = {
            hasMetadata: !!metadataData,
            hasEvents: !!eventsData,
            eventCount: eventsData ? JSON.parse(eventsData).length : 0
          };
        } catch (error) {
          healthData.facilities[facilityId] = {
            hasMetadata: false,
            hasEvents: false,
            eventCount: 0,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      }

      const healthDataJson = JSON.stringify(healthData);
      return new Response(healthDataJson, {
        status: 200,
        headers: await getCacheHeaders(CACHE_DURATIONS.ERRORS, false, healthDataJson) // Short cache for health checks
      });
    }

    // GET / or /api - Root endpoint with basic info
    if (path === '/' || path === '/api') {
      const apiInfoJson = JSON.stringify({
        service: 'Denver Rink Schedule Data API',
        version: '1.0.0',
        endpoints: [
          '/api/health',
          '/api/all-events',
          '/api/all-metadata',
          '/data/{facilityId}.json',
          '/data/{facilityId}-metadata.json'
        ],
        availableFacilities: FACILITY_IDS
      });
      return new Response(apiInfoJson, {
        status: 200,
        headers: await getCacheHeaders(3600, false, apiInfoJson) // Cache API info for 1 hour
      });
    }

    // 404 for unknown paths
    console.log(`❌ Unknown path: ${path}`);
    const notFoundJson = JSON.stringify({
      error: 'Not found',
      path,
      availableEndpoints: [
        '/api/health',
        '/api/all-events',
        '/api/all-metadata',
        '/data/{facilityId}.json',
        '/data/{facilityId}-metadata.json'
      ]
    });
    return new Response(notFoundJson, {
      status: 404,
      headers: {
        ...(await getCacheHeaders(CACHE_DURATIONS.ERRORS, false, notFoundJson)),
        'Cache-Control': 'public, max-age=60, no-cache' // Short cache for 404s
      }
    });

  } catch (error) {
    console.error('❌ Error handling request:', error);

    const errorJson = JSON.stringify({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      path
    });
    return new Response(errorJson, {
      status: 500,
      headers: {
        ...(await getCacheHeaders(30, false, errorJson)), // Very short cache for server errors
        'Cache-Control': 'no-cache, no-store, must-revalidate' // Don't cache server errors
      }
    });
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Handle CORS preflight
    const corsResponse = handleCORS(request);
    if (corsResponse) return corsResponse;

    return await handleDataRequest(request, env);
  }
};
