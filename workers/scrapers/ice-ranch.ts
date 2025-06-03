// CloudFlare Worker: Ice Ranch Scraper with Durable Object scheduling
// This worker uses a Durable Object to schedule scraping at random times

interface Env {
  RINK_DATA: KVNamespace;
  ICE_RANCH_SCHEDULER: DurableObjectNamespace;
}

interface RawIceEventData {
  id: string;
  rinkId: string;
  title: string;
  startTime: string; // ISO string in worker
  endTime: string;   // ISO string in worker
  description?: string;
  category: string;
  isFeatured?: boolean;
  eventUrl?: string;
}

interface FacilityMetadata {
  facilityId: string;
  facilityName: string;
  displayName: string;
  lastSuccessfulScrape?: string;
  lastAttempt: string;
  status: 'success' | 'error';
  eventCount: number;
  errorMessage?: string;
  sourceUrl: string;
  rinks: Array<{
    rinkId: string;
    rinkName: string;
  }>;
}

// Tag ID to category mapping (from ice-ranch.html UI)
const ICE_RANCH_TAGS: Record<string, string> = {
  '1652315': 'Home',
  '1652320': 'Calendar', 
  '1718896': 'All Ages Stick & Puck',
  '1718895': 'Adult Drop In',
  '1718913': 'Teen Drop In',
  '1718914': '12 & Under Stick & Puck',
  '1718915': '13 & Over Stick & Puck',
  '1718916': 'Coach Ice',
  '1718917': 'Public Skate',
  '7870619': 'Adult Lunch Leagues & Learn to Play',
};

const ICE_RANCH_RSS_URL = 'https://www.theiceranch.com/event_rss_feed?tags=1652315,1652320,1718896,1718895,1718913,1718914,1718915,1718916,1718917,7870619';

class IceRanchScraper {
  private readonly rinkId = 'ice-ranch';
  private readonly rinkName = 'Ice Ranch';

  // Clean event title
  private cleanTitle(rawTitle: string): string {
    let cleanTitle = rawTitle.trim();
    cleanTitle = cleanTitle.replace(/^\d{1,2}([A-Za-z])/, '$1');
    cleanTitle = cleanTitle.replace(/^-\s*/, '');
    cleanTitle = cleanTitle.replace(/register/gi, '');
    cleanTitle = cleanTitle.replace(/click here/gi, '');
    cleanTitle = cleanTitle.replace(/^\W+/, '');
    return cleanTitle.trim();
  }

  // Categorize event by title
  private categorizeEvent(title: string): string {
    const titleLower = title.toLowerCase();
    if (titleLower.includes('closed') || titleLower.includes('holiday')) return 'Special Event';
    if (titleLower.includes('public skate') || titleLower.includes('open skate')) return 'Public Skate';
    if (titleLower.includes('stick') && titleLower.includes('puck')) return 'Stick & Puck';
    if (titleLower.includes('drop') || titleLower.includes('pickup')) return 'Drop-In Hockey';
    if (titleLower.includes('learn') || titleLower.includes('lesson')) return 'Learn to Skate';
    if (titleLower.includes('freestyle') || titleLower.includes('figure')) return 'Figure Skating';
    if (titleLower.includes('practice') || titleLower.includes('training')) return 'Hockey Practice';
    if (titleLower.includes('league') || titleLower.includes('game')) return 'Hockey League';
    return 'Other';
  }

  // Parse XML using basic string parsing (no xml2js in workers)
  private parseBasicXML(xml: string): any[] {
    const items: any[] = [];
    const itemRegex = /<item>(.*?)<\/item>/gs;
    let match;

    while ((match = itemRegex.exec(xml)) !== null) {
      const itemContent = match[1];
      const item: any = {};

      // Extract fields - try multiple patterns for titles
      let titleMatch = itemContent.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/s);
      if (!titleMatch) {
        titleMatch = itemContent.match(/<title>(.*?)<\/title>/s);
      }
      if (titleMatch) item.title = titleMatch[1];

      // Extract descriptions - try multiple patterns
      let descMatch = itemContent.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/s);
      if (!descMatch) {
        descMatch = itemContent.match(/<description>(.*?)<\/description>/s);
      }
      if (descMatch) item.description = descMatch[1];

      const linkMatch = itemContent.match(/<link>(.*?)<\/link>/s);
      if (linkMatch) item.link = linkMatch[1];

      const pubDateMatch = itemContent.match(/<pubDate>(.*?)<\/pubDate>/s);
      if (pubDateMatch) item.pubDate = pubDateMatch[1];

      // Debug logging
      console.log(`Parsed item: title="${item.title}", desc length=${item.description?.length || 0}`);

      items.push(item);
    }

    console.log(`Parsed ${items.length} items from XML`);
    return items;
  }

  async scrape(): Promise<RawIceEventData[]> {
    console.log(`🧊 Scraping Ice Ranch events from RSS feed...`);
    
    const response = await fetch(ICE_RANCH_RSS_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DenverRinkScheduler/1.0)',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const xml = await response.text();
    const items = this.parseBasicXML(xml);

    if (!items.length) {
      console.warn('No events found in Ice Ranch RSS feed.');
      return [];
    }

    const events: RawIceEventData[] = items.map((item: any, idx: number) => {
      // Example title: "Sunday June 1, 2025: Coach's Ice"
      let title: string = item.title || 'Untitled Event';
      
      // Remove date prefix if present
      title = title.replace(/^[A-Za-z]+ [A-Za-z]+ \d{1,2}, \d{4}:\s*/, '');
      title = this.cleanTitle(title);

      const description: string = item.description || '';
      const link: string = item.link || '';
      const pubDate: string = item.pubDate || '';

      // Parse start time from pubDate
      const startTime = pubDate ? new Date(pubDate) : new Date();

      // Try to extract end time from description
      let endTime: Date = new Date(startTime);
      const timeMatch = description.match(/Time:\s*([\d:apm ]+)-(\d{1,2}:\d{2}[ap]m)/i);
      if (timeMatch) {
        const [, , endStr] = timeMatch;
        const endMatch = endStr.match(/(\d{1,2}):(\d{2})(am|pm)/i);
        if (endMatch) {
          const [, endHour, endMinute, endPeriod] = endMatch;
          endTime = new Date(startTime);
          let hour = parseInt(endHour, 10);
          if (endPeriod.toLowerCase() === 'pm' && hour < 12) hour += 12;
          if (endPeriod.toLowerCase() === 'am' && hour === 12) hour = 0;
          endTime.setHours(hour, parseInt(endMinute, 10), 0, 0);
        }
      }

      // Extract category from tags or title
      let category = 'Other';
      const tagMatch = description.match(/Tag\(s\): ([^<]+)/);
      if (tagMatch) {
        const tags = tagMatch[1].split(',').map(t => t.trim());
        for (const tag of tags) {
          const mapped = Object.values(ICE_RANCH_TAGS).find(cat => tag === cat);
          if (mapped) {
            category = mapped;
            break;
          }
        }
      } else {
        category = this.categorizeEvent(title);
      }

      return {
        id: `ice-ranch-${startTime.getTime()}-${idx}`,
        rinkId: this.rinkId,
        title,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        category,
        description: description.replace(/<br\s*\/?\s*>/gi, '\n'),
        eventUrl: link || undefined,
        isFeatured: false
      };
    });

    events.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    console.log(`🧊 Ice Ranch: Found ${events.length} events from RSS`);
    return events;
  }
}

async function writeToKV(kvNamespace: KVNamespace, rinkId: string, events: RawIceEventData[]): Promise<void> {
  // Store events data
  await kvNamespace.put(`events:${rinkId}`, JSON.stringify(events));
  
  // Store metadata
  const metadata: FacilityMetadata = {
    facilityId: rinkId,
    facilityName: 'Ice Ranch',
    displayName: 'The Ice Ranch (Littleton)',
    lastAttempt: new Date().toISOString(),
    status: 'success',
    eventCount: events.length,
    sourceUrl: ICE_RANCH_RSS_URL,
    rinks: [{ rinkId, rinkName: 'Main Rink' }],
    lastSuccessfulScrape: new Date().toISOString()
  };
  
  await kvNamespace.put(`metadata:${rinkId}`, JSON.stringify(metadata));
  
  console.log(`💾 Stored ${events.length} events and metadata for ${rinkId}`);
}

async function writeErrorMetadata(kvNamespace: KVNamespace, rinkId: string, error: any): Promise<void> {
  const errorMetadata: FacilityMetadata = {
    facilityId: rinkId,
    facilityName: 'Ice Ranch',
    displayName: 'The Ice Ranch (Littleton)',
    lastAttempt: new Date().toISOString(),
    status: 'error',
    eventCount: 0,
    errorMessage: error instanceof Error ? error.message : 'Unknown error',
    sourceUrl: ICE_RANCH_RSS_URL,
    rinks: [{ rinkId: rinkId, rinkName: 'Main Rink' }]
  };
  
  await kvNamespace.put(`metadata:${rinkId}`, JSON.stringify(errorMetadata));
  console.log(`💾 Stored error metadata for ${rinkId}: ${errorMetadata.errorMessage}`);
}

// Durable Object for scheduling scraping
export class IceRanchScheduler {
  private state: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  // Get random delay between 0 and maxMinutes
  private getRandomDelay(maxMinutes: number = 360): number {
    return Math.floor(Math.random() * maxMinutes * 60 * 1000);
  }

  // Schedule the next scrape with random splay
  async scheduleNextScrape(): Promise<void> {
    const delay = this.getRandomDelay(360); // 0-6 hours
    const nextScrapeTime = new Date(Date.now() + delay);
    
    console.log(`🕐 Scheduling next Ice Ranch scrape for ${nextScrapeTime.toISOString()} (in ${Math.floor(delay/60000)} minutes)`);
    
    // Set alarm for the scheduled time
    await this.state.storage.setAlarm(nextScrapeTime);
    await this.state.storage.put('lastScheduled', nextScrapeTime.toISOString());
  }

  // Perform the actual scraping
  async performScrape(): Promise<{ success: boolean; eventCount?: number; error?: string }> {
    try {
      console.log(`🧊 Starting scheduled Ice Ranch scrape at ${new Date().toISOString()}`);
      
      const scraper = new IceRanchScraper();
      const events = await scraper.scrape();
      await writeToKV(this.env.RINK_DATA, 'ice-ranch', events);
      
      console.log(`✅ Ice Ranch scraping completed successfully: ${events.length} events`);
      
      // Schedule the next scrape
      await this.scheduleNextScrape();
      
      return { success: true, eventCount: events.length };
    } catch (error) {
      console.error(`❌ Ice Ranch scraping failed:`, error);
      
      // Store error metadata
      await writeErrorMetadata(this.env.RINK_DATA, 'ice-ranch', error);
      
      // Still schedule next scrape even after failure
      await this.scheduleNextScrape();
      
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Handle alarm (when it's time to scrape)
  async alarm(): Promise<void> {
    console.log(`⏰ Ice Ranch scraper alarm triggered at ${new Date().toISOString()}`);
    await this.performScrape();
  }

  // Handle requests to the Durable Object
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/schedule') {
      // Schedule next scrape (called by cron)
      await this.scheduleNextScrape();
      return new Response(JSON.stringify({
        success: true,
        message: 'Next scrape scheduled',
        timestamp: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (url.pathname === '/scrape-now') {
      // Manual trigger
      const result = await this.performScrape();
      return new Response(JSON.stringify({
        ...result,
        timestamp: new Date().toISOString()
      }), {
        status: result.success ? 200 : 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (url.pathname === '/status') {
      // Get status
      const lastScheduled = await this.state.storage.get('lastScheduled');
      const nextAlarm = await this.state.storage.getAlarm();
      
      return new Response(JSON.stringify({
        lastScheduled,
        nextAlarm: nextAlarm ? new Date(nextAlarm).toISOString() : null,
        timestamp: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response('Ice Ranch Scheduler - Available endpoints: /schedule, /scrape-now, /status', {
      status: 404,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// Named export for Durable Object (required by Cloudflare)
//export { IceRanchScheduler };

// Main worker export
export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log(`🕐 Ice Ranch scheduler cron triggered at ${new Date().toISOString()}`);
    
    try {
      // Get the Durable Object instance
      const id = env.ICE_RANCH_SCHEDULER.idFromName('ice-ranch-scheduler');
      const stub = env.ICE_RANCH_SCHEDULER.get(id);
      
      // Tell it to schedule the next scrape
      const response = await stub.fetch('http://internal/schedule');
      const result = await response.json();
      
      console.log(`📅 Scheduler response:`, result);
    } catch (error) {
      console.error(`❌ Failed to schedule Ice Ranch scrape:`, error);
    }
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // Get the Durable Object instance
    const id = env.ICE_RANCH_SCHEDULER.idFromName('ice-ranch-scheduler');
    const stub = env.ICE_RANCH_SCHEDULER.get(id);
    
    if (request.method === 'POST') {
      // Manual trigger - forward to Durable Object
      const response = await stub.fetch('http://internal/scrape-now');
      return response;
    }
    
    if (url.pathname === '/status') {
      // Status check - forward to Durable Object
      const response = await stub.fetch('http://internal/status');
      return response;
    }
    
    // Default response
    return new Response('Ice Ranch Scraper Worker - Use POST to trigger scraping, /status for status', { 
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};
