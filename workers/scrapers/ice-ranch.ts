// workers/scrapers/ice-ranch.ts - Ice Ranch scraper with Durable Objects scheduling
import { ScraperHelpers, RawIceEventData, FacilityMetadata } from './scraper-helpers';

interface Env {
  RINK_DATA: KVNamespace;
  ICE_RANCH_SCHEDULER: DurableObjectNamespace;
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
        'User-Agent': ScraperHelpers.getUserAgent(),
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
      title = ScraperHelpers.cleanTitle(title);

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
        category = ScraperHelpers.categorizeEvent(title);
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

    console.log(`🧊 Ice Ranch: Found ${events.length} events from RSS`);
    return events;
  }
}

// Durable Object for scheduling Ice Ranch scraper
export class IceRanchScheduler {
  state: DurableObjectState;
  env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/status') {
      const nextAlarm = await this.state.storage.getAlarm();
      const lastRun = await this.state.storage.get('lastRun');
      
      return ScraperHelpers.jsonResponse({
        nextAlarm: nextAlarm ? new Date(nextAlarm).toISOString() : null,
        lastRun: lastRun || null,
        rinkId: 'ice-ranch'
      });
    }

    if (path === '/schedule' || request.method === 'GET') {
      // Schedule alarm with 6 hour splay (360 minutes)
      const nextAlarmTime = ScraperHelpers.getNextScheduledTime(360);
      await this.state.storage.setAlarm(nextAlarmTime);
      
      return new Response(
        `Ice Ranch Worker - Scheduling alarm for ${nextAlarmTime.toISOString()}`,
        { headers: ScraperHelpers.corsHeaders() }
      );
    }

    if (request.method === 'POST') {
      return await this.runScraper();
    }

    return new Response('Ice Ranch Scheduler - Use GET to schedule, POST to run manually, /status for info', {
      headers: ScraperHelpers.corsHeaders()
    });
  }

  async alarm(): Promise<void> {
    console.log(`⏰ Ice Ranch alarm triggered at ${new Date().toISOString()}`);
    
    try {
      await this.runScraper();
      
      // Schedule next alarm with 6 hour splay
      const nextAlarmTime = ScraperHelpers.getNextScheduledTime(360);
      await this.state.storage.setAlarm(nextAlarmTime);
      console.log(`📅 Next Ice Ranch alarm scheduled for ${nextAlarmTime.toISOString()}`);
      
    } catch (error) {
      console.error('❌ Ice Ranch alarm failed:', error);
      
      // Still schedule next alarm even if this one failed
      const nextAlarmTime = ScraperHelpers.getNextScheduledTime(360);
      await this.state.storage.setAlarm(nextAlarmTime);
    }
  }

  private async runScraper(): Promise<Response> {
    const startTime = Date.now();
    
    try {
      console.log('🔧 Ice Ranch scraper triggered');
      const scraper = new IceRanchScraper();
      const events = await scraper.scrape();
      
      await ScraperHelpers.writeToKV(this.env.RINK_DATA, 'ice-ranch', events, {
        facilityName: 'Ice Ranch',
        displayName: 'The Ice Ranch (Littleton)',
        sourceUrl: ICE_RANCH_RSS_URL,
        rinkName: 'Main Rink'
      });

      // Update last run time
      await this.state.storage.put('lastRun', new Date().toISOString());

      const duration = Date.now() - startTime;
      console.log(`✅ Ice Ranch scraping completed in ${duration}ms`);

      return ScraperHelpers.jsonResponse({
        success: true,
        eventCount: events.length,
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`,
        message: `Successfully scraped ${events.length} events`
      });

    } catch (error) {
      console.error('❌ Ice Ranch scraping failed:', error);
      
      await ScraperHelpers.writeErrorMetadata(this.env.RINK_DATA, 'ice-ranch', error, {
        facilityName: 'Ice Ranch',
        displayName: 'The Ice Ranch (Littleton)',
        sourceUrl: ICE_RANCH_RSS_URL,
        rinkName: 'Main Rink'
      });

      return ScraperHelpers.jsonResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }, 500);
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Get the Durable Object instance
    const id = env.ICE_RANCH_SCHEDULER.idFromName('ice-ranch');
    const stub = env.ICE_RANCH_SCHEDULER.get(id);
    
    return stub.fetch(request);
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log(`🕐 Ice Ranch cron triggered at ${new Date().toISOString()}`);
    
    // Get the Durable Object and trigger scheduling
    const id = env.ICE_RANCH_SCHEDULER.idFromName('ice-ranch');
    const stub = env.ICE_RANCH_SCHEDULER.get(id);
    
    // Call the GET endpoint to schedule an alarm
    await stub.fetch(new Request('https://fake.url/', { method: 'GET' }));
  }
};
