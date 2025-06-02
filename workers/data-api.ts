// CloudFlare Worker: Data API (Fixed)
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

  console.log(`🔍 Request path: ${path}`);

  try {
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
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=300', // 5 minutes
            ...corsHeaders
          }
        });
      }

      console.log(`✅ Found events data for ${facilityId}`);
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
      console.log(`📋 Fetching metadata for facility: ${facilityId}`);
      const metadataData = await env.RINK_DATA.get(`metadata:${facilityId}`);
      
      console.log(`Metadata request for ${facilityId}, found: ${!!metadataData}`);
      
      if (!metadataData) {
        console.log(`⚠️ No metadata found for ${facilityId}, returning default`);
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

      console.log(`✅ Found metadata for ${facilityId}`);
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
      console.log(`📊 Fetching all events`);
      const allEvents = [];
      
      for (const facilityId of FACILITY_IDS) {
        try {
          const eventsData = await env.RINK_DATA.get(`events:${facilityId}`);
          if (eventsData) {
            const events = JSON.parse(eventsData);
            allEvents.push(...events);
            console.log(`✅ Loaded ${events.length} events from ${facilityId}`);
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
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300', // 5 minutes
          ...corsHeaders
        }
      });
    }

    // GET /api/all-metadata - Get metadata for all facilities
    if (path === '/api/all-metadata') {
      console.log(`📋 Fetching all metadata`);
      const allMetadata: Record<string, any> = {};
      
      for (const facilityId of FACILITY_IDS) {
        try {
          const metadataData = await env.RINK_DATA.get(`metadata:${facilityId}`);
          if (metadataData) {
            allMetadata[facilityId] = JSON.parse(metadataData);
            console.log(`✅ Loaded metadata for ${facilityId}`);
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
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300', // 5 minutes
          ...corsHeaders
        }
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
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=60', // 1 minute
          ...corsHeaders
        }
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
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // 404 for unknown paths
    console.log(`❌ Unknown path: ${path}`);
    return new Response(JSON.stringify({ 
      error: 'Not found',
      path: path,
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
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('❌ Error handling request:', error);
    
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      path: path
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
