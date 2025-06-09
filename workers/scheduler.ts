// workers/scheduler.ts - Centralized scheduler for all rink scrapers

interface Env {
  RINK_DATA: KVNamespace;
  SCRAPER_ENDPOINTS: string;
  SCRAPER_ENDPOINT_TEMPLATE: string;
}

interface ScraperResult {
  name: string;
  success: boolean;
  status?: number;
  error?: string;
}

// Robust URL templating function for future extensibility
function buildScraperUrl(template: string, variables: Record<string, string>): string {
  return template.replace(/\$\{([^}]+)\}/g, (match, key) => {
    if (key in variables) {
      return variables[key];
    }
    console.warn(`Template variable '${key}' not found in variables:`, variables);
    return match; // Return original if not found
  });
}

// Define the scheduled function outside the export to avoid 'this' context issues
async function scheduledHandler(event: ScheduledEvent, env: Env): Promise<void> {
    console.log('🕒 Centralized scheduler triggered at', new Date().toISOString());
    
    // Parse scraper endpoints from environment
    const scraperNames = env.SCRAPER_ENDPOINTS?.split(',').map(s => s.trim()) || [];
    
    if (scraperNames.length === 0) {
      console.error('❌ No scraper endpoints configured in SCRAPER_ENDPOINTS');
      return;
    }
    
    console.log(`📋 Scheduling ${scraperNames.length} scrapers: ${scraperNames.join(', ')}`);
    
    // Generate URLs dynamically using robust templating (supports future variables)
    const scraperUrls = scraperNames.map(name => {
      const url = buildScraperUrl(env.SCRAPER_ENDPOINT_TEMPLATE, {
        'rink-name': name,
        // Easy to add more variables in the future:
        // 'environment': env.ENVIRONMENT || 'production',
        // 'region': env.REGION || 'us-east-1'
      });
      return { name, url };
    });
    
    // Schedule all scrapers in parallel using HTTP with global_fetch_strictly_public
    const results: ScraperResult[] = [];
    const promises = scraperUrls.map(async (scraper) => {
      try {
        console.log(`📞 Scheduling ${scraper.name} at ${scraper.url}`);
        
        // Use HTTP fetch with global_fetch_strictly_public flag
        const response = await fetch(scraper.url, {
          method: 'GET'
        });
        
        console.log(`📊 Response for ${scraper.name}: status=${response.status}, ok=${response.ok}`);
        
        if (!response.ok) {
          const responseText = await response.text();
          console.log(`❌ ${scraper.name} error response: ${responseText}`);
        }
        
        const success = response.ok;
        results.push({
          name: scraper.name,
          success,
          status: response.status
        });
        
        if (success) {
          console.log(`✅ Successfully scheduled ${scraper.name} (${response.status})`);
        } else {
          console.error(`❌ Failed to schedule ${scraper.name}: HTTP ${response.status}`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          name: scraper.name,
          success: false,
          error: errorMsg
        });
        console.error(`❌ Failed to schedule ${scraper.name}:`, errorMsg);
      }
    });
    
    await Promise.all(promises);
    
    // Log summary
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`📊 Scheduling complete: ${successful} successful, ${failed} failed`);
    
    if (failed > 0) {
      const failedNames = results.filter(r => !r.success).map(r => r.name);
      console.warn(`⚠️ Failed scrapers: ${failedNames.join(', ')}`);
    }
    
    // Store scheduling metadata in KV for monitoring
    const schedulingMetadata = {
      timestamp: new Date().toISOString(),
      totalScrapers: scraperNames.length,
      successful,
      failed,
      results,
      nextScheduled: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString() // Next run in 6 hours
    };
    
    await env.RINK_DATA.put('scheduler-metadata', JSON.stringify(schedulingMetadata));
    console.log('💾 Stored scheduling metadata');
}

async function fetchHandler(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/status') {
      try {
        const metadata = await env.RINK_DATA.get('scheduler-metadata');
        if (metadata) {
          return new Response(metadata, {
            headers: { 'Content-Type': 'application/json' }
          });
        } else {
          return new Response(JSON.stringify({ error: 'No scheduling metadata found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to retrieve status' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    if (url.pathname === '/trigger') {
      // Manual trigger endpoint for testing
      try {
        const event = { scheduledTime: Date.now() } as ScheduledEvent;
        await scheduledHandler(event, env);
        return new Response('Scheduler manually triggered', {
          headers: { 'Content-Type': 'text/plain' }
        });
      } catch (error) {
        return new Response(`Error: ${error}`, {
          status: 500,
          headers: { 'Content-Type': 'text/plain' }
        });
      }
    }
    
    return new Response(`Denver Rink Scheduler
    
Available endpoints:
- GET /status - View scheduling status and metadata
- GET /trigger - Manually trigger scheduling (for testing)
    
Configured scrapers: ${env.SCRAPER_ENDPOINTS || 'None'}
Endpoint template: ${env.SCRAPER_ENDPOINT_TEMPLATE || 'None'}
Communication method: HTTP with global_fetch_strictly_public`, {
      headers: { 'Content-Type': 'text/plain' }
    });
}

// Export object that references the standalone functions to avoid 'this' context issues
export default {
  scheduled: scheduledHandler,
  fetch: fetchHandler
};