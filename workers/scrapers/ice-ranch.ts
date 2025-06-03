// workers/scrapers/ice-ranch.ts - Ice Ranch scraper with Durable Objects scheduling
import { ScraperHelpers, RawIceEventData } from '../helpers/scraper-helpers';

interface Env {
  RINK_DATA: KVNamespace;
  ICE_RANCH_SCHEDULER: DurableObjectNamespace;
  SCRAPER_SPLAY_MINUTES: string;
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

    const events: RawIceEventData[] = items.map((item: any) => {
      // Example title: "Sunday June 1, 2025: Coach's Ice"
      let title: string = item.title || 'Untitled Event';
      
      // Remove date prefix if present
      title = title.replace(/^[A-Za-z]+ [A-Za-z]+ \d{1,2}, \d{4}:\s*/, '');
      
      // Decode HTML entities in title
      title = title.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
      title = ScraperHelpers.cleanTitle(title);

      let description: string = item.description || '';
      const link: string = item.link || '';
      const pubDate: string = item.pubDate || '';

      // Decode HTML entities in description
      description = description.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

      // Parse start time from pubDate - this is the event's actual datetime
      let startTime = pubDate ? new Date(pubDate) : new Date();

      // Try to extract more precise times from description
      let endTime: Date = new Date(startTime);
      const timeMatch = description.match(/Time:\s*([\d:apm ]+)\s*-\s*(\d{1,2}:\d{2}[ap]m)/i);
      if (timeMatch) {
        const [, startStr, endStr] = timeMatch;
        
        // Parse start time from description using Mountain Time conversion
        const startMatch = startStr.trim().match(/(\d{1,2}):(\d{2})\s*([ap]m)/i);
        if (startMatch) {
          const timeStr = `${startMatch[1]}:${startMatch[2]} ${startMatch[3]}`;
          startTime = ScraperHelpers.parseMountainTime(timeStr, startTime);
        }
        
        // Parse end time using Mountain Time conversion
        const endMatch = endStr.match(/(\d{1,2}):(\d{2})([ap]m)/i);
        if (endMatch) {
          const timeStr = `${endMatch[1]}:${endMatch[2]} ${endMatch[3]}`;
          endTime = ScraperHelpers.parseMountainTime(timeStr, startTime);
        }
      } else {
        // If no time range found, default to 1 hour duration
        endTime = new Date(startTime.getTime() + (60 * 60 * 1000));
      }

      // Extract category from tags or title
      let category = 'Other';
      const tagMatch = description.match(/Tag\(s\): ([^<\n]+)/);
      if (tagMatch) {
        const tags = tagMatch[1].split(',').map(t => t.trim());
        // Find the most specific category (not Home or Calendar)
        for (const tag of tags) {
          if (tag !== 'Home' && tag !== 'Calendar') {
            const tagId = Object.keys(ICE_RANCH_TAGS).find(id => ICE_RANCH_TAGS[id] === tag);
            if (tagId) {
              category = tag;
              break;
            }
          }
        }
        // If no specific tag found, fallback to any tag
        if (category === 'Other') {
          for (const tag of tags) {
            const tagId = Object.keys(ICE_RANCH_TAGS).find(id => ICE_RANCH_TAGS[id] === tag);
            if (tagId) {
              category = tag;
              break;
            }
          }
        }
      } else {
        category = ScraperHelpers.categorizeEvent(title);
      }

      return {
        id: `ice-ranch-${startTime.getTime()}`,
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

    // Sort events by start time and filter to next 30 days
    const sortedEvents = ScraperHelpers.sortEventsByTime(events);
    const filteredEvents = ScraperHelpers.filterEventsToNext30Days(sortedEvents);

    console.log(`🧊 Ice Ranch: Found ${filteredEvents.length} events from RSS`);
    return filteredEvents;
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
    return ScraperHelpers.handleSchedulerFetch(
      request,
      this.state,
      this.env,
      'ice-ranch',
      () => this.runScraper()
    );
  }

  async alarm(): Promise<void> {
    return ScraperHelpers.handleSchedulerAlarm(
      this.state,
      this.env,
      'ice-ranch',
      () => this.runScraper()
    );
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

  async scheduled(_event: unknown, env: Env, _ctx: unknown): Promise<void> {
    console.log(`🕐 Ice Ranch cron triggered at ${new Date().toISOString()}`);
    
    // Get the Durable Object and trigger scheduling
    const id = env.ICE_RANCH_SCHEDULER.idFromName('ice-ranch');
    const stub = env.ICE_RANCH_SCHEDULER.get(id);
    
    // Call the GET endpoint to schedule an alarm
    await stub.fetch(new Request('https://fake.url/', { method: 'GET' }));
  }
};
