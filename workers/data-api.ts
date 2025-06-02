// CloudFlare Worker: Data API
// This worker serves rink data from KV to the frontend

interface Env {
  RINK_DATA: KVNamespace;
}

const FACILITY_IDS = [
  'ice-ranch',
  'big-bear', 
  'du-ritchie',
  'foothills-edge',
  'ssprd-249',
  'ssprd-250'
];

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400', // 24 hours
};

function handleCORS(request: Request): Response | null {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
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

  try {
    // GET /data/{facilityId}.json - Get events for specific facility
    const eventMatch = path.match(/^\/data\/([a-z0-9-]+)\.json$/);
    if (eventMatch) {
      const facilityId = eventMatch[1];
      const eventsData = await env.RINK_DATA.get(`events:${facilityId}`);
      
      if (!eventsData) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=300', // 5 minutes
            ...corsHeaders
          }
        });
      }

      return new Response(eventsData, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300', // 5 minutes
          ...corsHeaders
        }
      });
    }

    // GET /data/{facilityId}-metadata.json - Get metadata for specific facility
    const metadataMatch = path.match(/^\/data\/([a-z0-9-]+)-metadata\.json$/);
    if (metadataMatch) {
      const facilityId = metadataMatch[1];
      const metadataData = await env.RINK_DATA.get(`metadata:${facilityId}`);
      
      console.log(`Metadata request for ${facilityId}, found: ${!!metadataData}`);
      
      if (!metadataData) {
        // Return default metadata if not found
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
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=60', // 1 minute for error cases
            ...corsHeaders
          }
        });
      }

      return new Response(metadataData, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300', // 5 minutes
          ...corsHeaders
        }
      });
    }

    // GET /api/all-events - Get all events from all facilities
    if (path === '/api/all-events') {
      const allEvents = [];
      
      for (const facilityId of FACILITY_IDS) {
        try {
          const eventsData = await env.RINK_DATA.get(`events:${facilityId}`);
          if (eventsData) {
            const events = JSON.parse(eventsData);
            allEvents.push(...events);
          }
        } catch (error) {
          console.warn(`Failed to load events for ${facilityId}:`, error);
        }
      }

      return new Response(JSON.stringify(allEvents), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300', // 5 minutes
          ...corsHeaders
        }
      });
    }

    // GET /api/all-metadata - Get metadata for all facilities
    if (path === '/api/all-metadata') {
      const allMetadata: Record<string, any> = {};
      
      for (const facilityId of FACILITY_IDS) {
        try {
          const metadataData = await env.RINK_DATA.get(`metadata:${facilityId}`);
          if (metadataData) {
            allMetadata[facilityId] = JSON.parse(metadataData);
          }
        } catch (error) {
          console.warn(`Failed to load metadata for ${facilityId}:`, error);
        }
      }

      return new Response(JSON.stringify(allMetadata), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300', // 5 minutes
          ...corsHeaders
        }
      });
    }

    // GET /api/health - Health check with KV status
    if (path === '/api/health') {
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
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=60', // 1 minute
          ...corsHeaders
        }
      });
    }

    // 404 for unknown paths
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Error handling request:', error);
    
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
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
