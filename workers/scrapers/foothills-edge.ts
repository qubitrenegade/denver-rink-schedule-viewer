// workers/scrapers/foothills-edge.ts - Foothills Edge scraper with Durable Objects scheduling
import { ScraperHelpers, RawIceEventData } from '../helpers/scraper-helpers';

interface Env {
  RINK_DATA: KVNamespace;
  FOOTHILLS_EDGE_SCHEDULER: DurableObjectNamespace;
  SCRAPER_SPLAY_MINUTES: string;
}

class FoothillsEdgeScraper {
  private readonly rinkId = 'foothills-edge';
  private readonly rinkName = 'Foothills Ice Arena (Edge)';
  private readonly calendarUrl = 'https://calendar.ifoothills.org/calendars/edge-ice-arena-drop.php';

  private cleanTitle(rawTitle: string): string {
    return ScraperHelpers.cleanTitle(rawTitle);
  }

  private categorizeEvent(title: string): string {
    return ScraperHelpers.categorizeEvent(title);
  }

  // Parse time and handle Mountain Time zone
  private parseFoothillsTime(timeStr: string, baseDate: Date): Date {
    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*([AP])\.?M\.?/i);
    if (!timeMatch) return baseDate;
    let hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);
    const ampm = timeMatch[3].toLowerCase();
    if (ampm === 'p' && hours !== 12) hours += 12;
    if (ampm === 'a' && hours === 12) hours = 0;
    const result = new Date(baseDate);
    result.setUTCHours(hours, minutes, 0, 0);
    result.setTime(result.getTime() + (6 * 60 * 60 * 1000));
    return result;
  }

  private extractEventsFromJavaScript(html: string): RawIceEventData[] {
    const events: RawIceEventData[] = [];
    const eventsStartMatch = html.match(/events\s*=\s*\{"[0-9]{4}-[0-9]{2}-[0-9]{2}"/);
    if (!eventsStartMatch) return events;
    try {
      const startIndex = eventsStartMatch.index! + eventsStartMatch[0].indexOf('{');
      let braceCount = 0;
      let endIndex = startIndex;
      for (let i = startIndex; i < html.length; i++) {
        if (html[i] === '{') braceCount++;
        if (html[i] === '}') braceCount--;
        if (braceCount === 0) {
          endIndex = i;
          break;
        }
      }
      const eventsDataStr = html.substring(startIndex, endIndex + 1);
      const eventsData = JSON.parse(eventsDataStr);
      Object.entries(eventsData as Record<string, any[]>).forEach(([dateStr, dayEvents]) => {
        const [year, month, day] = dateStr.split('-').map(Number);
        const eventDate = new Date(year, month - 1, day);
        dayEvents.forEach((event: any, index: number) => {
          try {
            const title = event.name || 'Ice Activity';
            const timeIn = event.TimeIn || '12:00 PM';
            const timeOut = event.TimeOut || '1:30 PM';
            const startTime = this.parseFoothillsTime(timeIn, eventDate);
            const endTime = this.parseFoothillsTime(timeOut, eventDate);
            if (endTime <= startTime) return;
            const eventId = `${this.rinkId}-${dateStr}-${index}`;
            events.push({
              id: eventId,
              rinkId: this.rinkId,
              title: this.cleanTitle(title),
              startTime: startTime.toISOString(),
              endTime: endTime.toISOString(),
              category: this.categorizeEvent(title),
              description: event.Description || 'Ice activity at Foothills Edge Ice Arena',
              isFeatured: false
            });
          } catch {}
        });
      });
    } catch {}
    return events;
  }

  async scrape(): Promise<RawIceEventData[]> {
    const response = await fetch(this.calendarUrl, {
      headers: {
        'User-Agent': ScraperHelpers.getUserAgent()
      }
    });
    if (!response.ok) throw new Error(`Failed to fetch Foothills Edge calendar: ${response.status} ${response.statusText}`);
    const html = await response.text();
    let events = this.extractEventsFromJavaScript(html);
    if (!events.length) return [];
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    events = events.filter(event => {
      const start = new Date(event.startTime);
      return start >= now && start <= thirtyDaysFromNow;
    });
    events.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    return events;
  }
}

export class FoothillsEdgeScheduler {
  private state: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    return ScraperHelpers.handleSchedulerFetch(
      request,
      this.state,
      this.env,
      'foothills-edge',
      () => this.runScraper()
    );
  }

  async alarm(): Promise<void> {
    return ScraperHelpers.handleSchedulerAlarm(
      this.state,
      this.env,
      'foothills-edge',
      () => this.runScraper()
    );
  }

  private async runScraper(): Promise<Response> {
    const startTime = Date.now();
    
    try {
      console.log('🏔️ Starting Foothills Edge scraper...');
      const scraper = new FoothillsEdgeScraper();
      const events = await scraper.scrape();
      
      await ScraperHelpers.writeToKV(
        this.env.RINK_DATA,
        'foothills-edge',
        events,
        {
          facilityName: 'Foothills Ice Arena (Edge)',
          displayName: 'Foothills Ice Arena (Edge)',
          sourceUrl: 'https://calendar.ifoothills.org/calendars/edge-ice-arena-drop.php',
          rinkName: 'Main Rink'
        }
      );

      const duration = Date.now() - startTime;
      await this.state.storage.put('lastRun', new Date().toISOString());
      
      console.log(`✅ Foothills Edge: ${events.length} events scraped in ${duration}ms`);
      
      return new Response(JSON.stringify({
        success: true,
        eventCount: events.length,
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`,
        message: `Successfully scraped ${events.length} events`
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      console.error('❌ Foothills Edge scraper error:', error);
      
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}

export default {
  async scheduled(_event: unknown, env: Env, _ctx: unknown): Promise<void> {
    // Cron trigger - wake up a random Durable Object instance
    const id = env.FOOTHILLS_EDGE_SCHEDULER.idFromName('scheduler');
    const obj = env.FOOTHILLS_EDGE_SCHEDULER.get(id);
    await obj.fetch('https://dummy-url/', { method: 'GET' });
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    // Route requests to the Durable Object
    const id = env.FOOTHILLS_EDGE_SCHEDULER.idFromName('scheduler');
    const obj = env.FOOTHILLS_EDGE_SCHEDULER.get(id);
    return obj.fetch(request);
  }
};
