// workers/scrapers/foothills-edge.ts - Foothills Edge scraper with Durable Objects scheduling
import { ScraperHelpers, RawIceEventData } from '../helpers/scraper-helpers';
// import { CONTENT_EXTRACTION, TIME_PATTERNS, RegexHelpers } from '../shared/regex-patterns';
import { CONTENT_EXTRACTION, RegexHelpers } from '../shared/regex-patterns';
import { ColoradoTimezone } from '../shared/timezone-utils';

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
    const parsedTime = RegexHelpers.parse12HourTime(timeStr);
    if (!parsedTime) return baseDate;
    
    const result = new Date(baseDate);
    result.setHours(parsedTime.hours, parsedTime.minutes, 0, 0);
    // Use DST-aware timezone conversion instead of hardcoded +6 hours
    return ColoradoTimezone.mountainTimeToUTC(result);
  }

  private extractEventsFromJavaScript(html: string): RawIceEventData[] {
    const events: RawIceEventData[] = [];
    const eventsStartMatch = html.match(CONTENT_EXTRACTION.EVENTS_OBJECT);
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
      Object.entries(eventsData as Record<string, unknown[]>).forEach(([dateStr, dayEvents]) => {
        const [year, month, day] = dateStr.split('-').map(Number);
        const eventDate = new Date(year, month - 1, day);
        dayEvents.forEach((event: unknown, index: number) => {
          try {
            const e = event as Record<string, unknown>;
            const title = e.name || 'Ice Activity';
            const timeIn = e.TimeIn || '12:00 PM';
            const timeOut = e.TimeOut || '1:30 PM';
            const startTime = this.parseFoothillsTime(timeIn as string, eventDate);
            const endTime = this.parseFoothillsTime(timeOut as string, eventDate);
            if (endTime <= startTime) return;
            const eventId = `${this.rinkId}-${dateStr}-${index}`;
            events.push({
              id: eventId,
              rinkId: this.rinkId,
              title: this.cleanTitle(title as string),
              startTime: startTime.toISOString(),
              endTime: endTime.toISOString(),
              category: this.categorizeEvent(title as string),
              description: e.Description || 'Ice activity at Foothills Edge Ice Arena',
              isFeatured: false
            });
          } catch {
            // Ignore individual event parsing errors
          }
        });
      });
    } catch {
      // Ignore JSON parsing errors
    }
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

      await ScraperHelpers.writeToKV(this.env.RINK_DATA, 'foothills-edge', events);

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
  async fetch(request: Request, env: Env): Promise<Response> {
    // Route requests to the Durable Object
    const id = env.FOOTHILLS_EDGE_SCHEDULER.idFromName('scheduler');
    const obj = env.FOOTHILLS_EDGE_SCHEDULER.get(id);
    return obj.fetch(request);
  }
  
  // Cron scheduling removed - now managed by centralized scheduler
};
