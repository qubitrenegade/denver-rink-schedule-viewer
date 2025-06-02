// workers/scrapers/big-bear.ts - Big Bear scraper worker
interface Env {
  RINK_DATA: KVNamespace;
}

interface RawIceEventData {
  id: string;
  rinkId: string;
  title: string;
  startTime: string;
  endTime: string;
  description?: string;
  category: string;
  isFeatured?: boolean;
  eventUrl?: string;
}

interface FacilityMetadata {
  facilityId: string;
  facilityName: string;
  displayName: string;
  lastAttempt: string;
  status: 'success' | 'error';
  eventCount: number;
  errorMessage?: string;
  sourceUrl: string;
  rinks: Array<{
    rinkId: string;
    rinkName: string;
  }>;
  lastSuccessfulScrape?: string;
}

class BigBearScraper {
  private readonly rinkId = 'big-bear';
  private readonly rinkName = 'Big Bear Ice Arena';
  private readonly baseUrl = 'https://bigbearicearena.ezfacility.com';

  private categorizeEvent(title: string): string {
    const titleLower = title.toLowerCase();
    if (titleLower.includes('public skate')) return 'Public Skate';
    if (titleLower.includes('freestyle') || titleLower.includes('free style')) return 'Figure Skating';
    if (titleLower.includes('stick') && titleLower.includes('puck')) return 'Stick & Puck';
    if (titleLower.includes('drop-in') || titleLower.includes('drop in')) return 'Drop-In Hockey';
    if (titleLower.includes('party room') || titleLower.includes('hockey party')) return 'Special Event';
    if (titleLower.includes('closed') || titleLower.includes('holiday')) return 'Special Event';
    if (titleLower.includes('learn') || titleLower.includes('lesson')) return 'Learn to Skate';
    if (titleLower.includes('freestyle') || titleLower.includes('figure')) return 'Figure Skating';
    if (titleLower.includes('practice') || titleLower.includes('training')) return 'Hockey Practice';
    if (titleLower.includes('league') || titleLower.includes('game')) return 'Hockey League';
    return 'Other';
  }

  private cleanTitle(rawTitle: string): string {
    let cleanTitle = rawTitle.trim();
    cleanTitle = cleanTitle.replace(/^\d{1,2}([A-Za-z])/, '$1');
    cleanTitle = cleanTitle.replace(/^-\s*/, '');
    cleanTitle = cleanTitle.replace(/register/gi, '');
    cleanTitle = cleanTitle.replace(/click here/gi, '');
    cleanTitle = cleanTitle.replace(/^\W+/, '');
    return cleanTitle.trim();
  }

  private getTodayString(offsetDays: number = 0): string {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
  }

  async scrape(): Promise<RawIceEventData[]> {
    const url = `${this.baseUrl}/Sessions/FilterResults`;
    
    const formData = new URLSearchParams({
      LocationId: '13558',
      Sunday: 'true', Monday: 'true', Tuesday: 'true', Wednesday: 'true', 
      Thursday: 'true', Friday: 'true', Saturday: 'true',
      StartTime: '12:00 AM', EndTime: '12:00 AM',
      'ReservationTypes[0].Selected': 'true', 'ReservationTypes[0].Id': '-1',
      StartDate: this.getTodayString(-3), 
      EndDate: this.getTodayString(32)
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (compatible; DenverRinkScheduler/1.0)'
      },
      body: formData.toString()
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Big Bear events: ${response.status} ${response.statusText}`);
    }

    const eventsJson = await response.json();
    if (!Array.isArray(eventsJson)) {
      throw new Error('Big Bear API did not return an array');
    }

    const events: RawIceEventData[] = eventsJson.map((ev: any) => {
      // Convert Mountain Time to UTC by adding 6 hours
      const startTime = new Date(ev.start);
      startTime.setHours(startTime.getHours() + 6);
      
      const endTime = new Date(ev.end);
      endTime.setHours(endTime.getHours() + 6);

      const rinkName = ev.resourceName || (ev.venues && ev.venues[0]?.Name) || 'Main Rink';
      const category = this.categorizeEvent(ev.title || ev.reservationType || '');

      return {
        id: `big-bear-${ev.id}`,
        rinkId: this.rinkId,
        title: this.cleanTitle(ev.title || ''),
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        description: `${rinkName}${ev.description ? ' - ' + ev.description : ''}`,
        category,
        isFeatured: false
      };
    });

    return events;
  }
}

// Add randomization to spread load
function getRandomDelay(maxMinutes: number = 60): number {
  return Math.floor(Math.random() * maxMinutes * 60 * 1000);
}

async function writeToKV(env: Env, rinkId: string, events: RawIceEventData[]): Promise<void> {
  await env.RINK_DATA.put(`events:${rinkId}`, JSON.stringify(events));
  
  const metadata: FacilityMetadata = {
    facilityId: rinkId,
    facilityName: 'Big Bear Ice Arena',
    displayName: 'Big Bear Ice Arena (Denver)',
    lastAttempt: new Date().toISOString(),
    status: 'success',
    eventCount: events.length,
    sourceUrl: 'https://bigbearicearena.ezfacility.com/Sessions',
    rinks: [{ rinkId, rinkName: 'Main Rink' }],
    lastSuccessfulScrape: new Date().toISOString()
  };
  
  await env.RINK_DATA.put(`metadata:${rinkId}`, JSON.stringify(metadata));
  console.log(`💾 Stored ${events.length} events and metadata for ${rinkId}`);
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log(`🕐 Big Bear scraper triggered at ${new Date().toISOString()}`);
    
    const delay = getRandomDelay(60);
    console.log(`⏱️ Waiting ${Math.floor(delay / 1000 / 60)} minutes before scraping...`);
    await new Promise(resolve => setTimeout(resolve, delay));
    
    try {
      const scraper = new BigBearScraper();
      const events = await scraper.scrape();
      await writeToKV(env, 'big-bear', events);
      console.log(`✅ Big Bear scraping completed successfully: ${events.length} events`);
    } catch (error) {
      console.error(`❌ Big Bear scraping failed:`, error);
      
      const errorMetadata: FacilityMetadata = {
        facilityId: 'big-bear',
        facilityName: 'Big Bear Ice Arena',
        displayName: 'Big Bear Ice Arena (Denver)',
        lastAttempt: new Date().toISOString(),
        status: 'error',
        eventCount: 0,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        sourceUrl: 'https://bigbearicearena.ezfacility.com/Sessions',
        rinks: [{ rinkId: 'big-bear', rinkName: 'Main Rink' }]
      };
      
      await env.RINK_DATA.put(`metadata:big-bear`, JSON.stringify(errorMetadata));
      throw error;
    }
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'POST') {
      try {
        console.log('🔧 Manual trigger received');
        const scraper = new BigBearScraper();
        const events = await scraper.scrape();
        await writeToKV(env, 'big-bear', events);
        
        return new Response(JSON.stringify({
          success: true,
          eventCount: events.length,
          timestamp: new Date().toISOString(),
          message: `Successfully scraped ${events.length} events`
        }), {
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }), {
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    }
    
    return new Response('Big Bear Scraper Worker - Use POST to trigger scraping', { 
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};

