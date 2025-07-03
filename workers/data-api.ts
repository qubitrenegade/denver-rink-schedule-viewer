// CloudFlare Worker: Data API (Fixed)
// This worker serves rink data from KV to the frontend

import { FACILITY_IDS, CORS_HEADERS, HTTP_STATUS, CACHE_DURATIONS } from './shared/constants';
import * as crypto from 'crypto';

// Enhanced cache headers utility
function getCacheHeaders(maxAge: number, isStale: boolean = false): Record<string, string> {
  const baseHeaders = {
    'Content-Type': 'application/json',
    'Cache-Control': `public, max-age=${maxAge}, stale-while-revalidate=${maxAge * 2}`,
    'ETag': `"${crypto.createHash('sha256').update(resourceContent).digest('hex')}"`, // ETag based on content hash
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
        return new Response(JSON.stringify(defaultMetadata), {
          status: 200,
          headers: getCacheHeaders(CACHE_DURATIONS.ERRORS, true)
        });
      }

      console.log(`✅ Found metadata for ${facilityId}`);
      return new Response(metadataData, {
        status: 200,
        headers: getCacheHeaders(CACHE_DURATIONS.METADATA)
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
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: getCacheHeaders(CACHE_DURATIONS.ERRORS, true)
        });
      }

      console.log(`✅ Found events data for ${facilityId}`);
      return new Response(eventsData, {
        status: 200,
        headers: getCacheHeaders(CACHE_DURATIONS.EVENTS)
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
      return new Response(JSON.stringify(allEvents), {
        status: 200,
        headers: getCacheHeaders(CACHE_DURATIONS.EVENTS)
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
      return new Response(JSON.stringify(allMetadata), {
        status: 200,
        headers: getCacheHeaders(CACHE_DURATIONS.METADATA)
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

      return new Response(JSON.stringify(healthData), {
        status: 200,
        headers: getCacheHeaders(CACHE_DURATIONS.ERRORS) // Short cache for health checks
      });
    }

    // GET / or /api - Root endpoint with basic info
    if (path === '/' || path === '/api') {
      return new Response(JSON.stringify({
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
      }), {
        status: 200,
        headers: {
          ...getCacheHeaders(3600, false, true) // Cache API info for 1 hour, immutable
        }
      });
    }

    // 404 for unknown paths
    console.log(`❌ Unknown path: ${path}`);
    return new Response(JSON.stringify({
      error: 'Not found',
      path,
      availableEndpoints: [
        '/api/health',
        '/api/all-events',
        '/api/all-metadata',
        '/data/{facilityId}.json',
        '/data/{facilityId}-metadata.json'
      ]
    }), {
      status: 404,
      headers: {
        ...getCacheHeaders(CACHE_DURATIONS.ERRORS),
        'Cache-Control': 'public, max-age=60, no-cache' // Short cache for 404s
      }
    });

  } catch (error) {
    console.error('❌ Error handling request:', error);

    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      path
    }), {
      status: 500,
      headers: {
        ...getCacheHeaders(30), // Very short cache for server errors
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
