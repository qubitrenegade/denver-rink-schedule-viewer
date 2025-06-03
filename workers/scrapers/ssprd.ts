// workers/scrapers/ssprd.ts - SSPRD scraper with Durable Objects scheduling
import { ScraperHelpers, RawIceEventData } from '../helpers/scraper-helpers';

interface Env {
  RINK_      // Write events for Family Sports Center facility
      await ScraperHelpers.writeToKV(this.env.RINK_DATA, 'fsc-avalanche', facilityEvents['ssprd-249']);space;
  SSPRD_SCHEDULER: DurableObjectNamespace;
  SCRAPER_SPLAY_MINUTES: string;
}

const facilityIdToRinkIdMap: Record<number, string> = {
  1904: 'fsc-avalanche',
  1905: 'fsc-fixit',
  1906: 'sssc-rink1',
  1907: 'sssc-rink2',
  1908: 'sssc-rink3',
};

class SSPRDScraper {
  constructor(private schedulePageId: string, private schedulePageUrl: string) {}

  get rinkId() { return `ssprd-${this.schedulePageId}`; }
  get rinkName() { return `SSPRD Schedule Page ${this.schedulePageId}`; }

  // Parse SSPRD datetime string and convert from Mountain Time to UTC
  private parseSSPRDDateTime(dateTimeStr: string): Date {
    const date = new Date(dateTimeStr);
    if (isNaN(date.getTime())) return new Date();
    const hasTimezone = /[+-]\d{2}:?\d{2}|Z|UTC|GMT|[A-Z]{3,4}T?$/i.test(dateTimeStr);
    if (!hasTimezone) {
      const year = date.getFullYear();
      const month = date.getMonth();
      const day = date.getDate();
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const seconds = date.getSeconds();
      const milliseconds = date.getMilliseconds();
      const utcDate = new Date(Date.UTC(year, month, day, hours, minutes, seconds, milliseconds));
      utcDate.setTime(utcDate.getTime() + (6 * 60 * 60 * 1000)); // Add 6 hours for MDT->UTC
      return utcDate;
    } else {
      return date;
    }
  }

  private categorizeEvent(title: string): string {
    return ScraperHelpers.categorizeEvent(title);
  }

  async scrape(): Promise<RawIceEventData[]> {
    const response = await fetch(this.schedulePageUrl, {
      headers: {
        'User-Agent': ScraperHelpers.getUserAgent()
      }
    });
    if (!response.ok) throw new Error(`Failed to fetch SSPRD schedule: ${response.status} ${response.statusText}`);
    const html = await response.text();
    // Extract _onlineScheduleList array from HTML using regex
    const match = html.match(/_onlineScheduleList\s*=\s*(\[.*?\]);/s);
    let events: RawIceEventData[] = [];
    if (match && match[1]) {
      try {
        const scheduleData = JSON.parse(match[1]);
        if (Array.isArray(scheduleData)) {
          scheduleData.forEach((item: any, index: number) => {
            const specificRinkId = facilityIdToRinkIdMap[item.FacilityId];
            if (!specificRinkId) return;
            const title = item.AccountName ? String(item.AccountName).trim() : 'Unnamed Event';
            let category = this.categorizeEvent(item.EventTypeName || title);
            if (category === 'Other' && item.EventTypeName !== title) {
              category = this.categorizeEvent(title);
            }
            const startTime = this.parseSSPRDDateTime(item.EventStartTime);
            const endTime = this.parseSSPRDDateTime(item.EventEndTime);
            if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) return;
            const isClosed = item.Closed === true || title.toLowerCase().includes('closed');
            events.push({
              id: `${specificRinkId}-${item.EventId || Date.now() + index}`,
              rinkId: specificRinkId,
              title: isClosed && !title.toLowerCase().includes('closed') ? `Closed: ${title}` : title,
              startTime: startTime.toISOString(),
              endTime: endTime.toISOString(),
              category,
              description: item.Description ? String(item.Description).trim() : undefined,
              isFeatured: item.isFeatured || false,
              eventUrl: undefined
            });
          });
        }
      } catch (e) {
        console.error(`Error parsing _onlineScheduleList JSON:`, e);
      }
    }
    events.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    return events;
  }
}

export class SSPRDScheduler {
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
      'ssprd',
      () => this.runScraper()
    );
  }

  async alarm(): Promise<void> {
    return ScraperHelpers.handleSchedulerAlarm(
      this.state,
      this.env,
      'ssprd',
      () => this.runScraper()
    );
  }

  private async runScraper(): Promise<Response> {
    const startTime = Date.now();
    
    try {
      console.log('🏢 Starting SSPRD scraper...');
      const scrapers = [
        new SSPRDScraper('249', 'https://ssprd.finnlyconnect.com/schedule/249'),
        new SSPRDScraper('250', 'https://ssprd.finnlyconnect.com/schedule/250')
      ];
      
      let allEvents: RawIceEventData[] = [];
      for (const scraper of scrapers) {
        const events = await scraper.scrape();
        allEvents = allEvents.concat(events);
      }
      
      // Group by rinkId
      const eventsByRink: Record<string, RawIceEventData[]> = {};
      for (const event of allEvents) {
        if (!eventsByRink[event.rinkId]) eventsByRink[event.rinkId] = [];
        eventsByRink[event.rinkId].push(event);
      }
      
      // Write each rink's events to KV
      const facilityEvents: Record<string, RawIceEventData[]> = {
        'ssprd-249': [],
        'ssprd-250': []
      };
      
      for (const [rinkId, events] of Object.entries(eventsByRink)) {
        // Write individual rink data using shared config
        await ScraperHelpers.writeToKV(this.env.RINK_DATA, rinkId, events);
        
        // Also aggregate into facility-level collections
        if (rinkId.startsWith('fsc-')) {
          facilityEvents['ssprd-249'] = facilityEvents['ssprd-249'].concat(events);
        } else if (rinkId.startsWith('sssc-')) {
          facilityEvents['ssprd-250'] = facilityEvents['ssprd-250'].concat(events);
        }
      }
      
      // Write facility-level aggregated data (these don't use shared config as they're aggregations)
      await ScraperHelpers.writeToKV(
        this.env.RINK_DATA,
        'ssprd-249',
        facilityEvents['ssprd-249'],
        {
          facilityName: 'Family Sports Center',
          displayName: 'Family Sports Center (Englewood)',
          sourceUrl: 'https://ssprd.finnlyconnect.com/schedule/249',
          rinkName: 'Family Sports Center'
        }
      );
      
      await ScraperHelpers.writeToKV(
        this.env.RINK_DATA,
        'ssprd-250',
        facilityEvents['ssprd-250'],
        {
          facilityName: 'South Suburban Sports Complex',
          displayName: 'South Suburban Sports Complex (Highlands Ranch)',
          sourceUrl: 'https://ssprd.finnlyconnect.com/schedule/250',
          rinkName: 'South Suburban Sports Complex'
        }
      );

      const duration = Date.now() - startTime;
      await this.state.storage.put('lastRun', new Date().toISOString());
      
      const totalEvents = Object.values(eventsByRink).reduce((sum, events) => sum + events.length, 0);
      console.log(`✅ SSPRD: ${totalEvents} events scraped across ${Object.keys(eventsByRink).length} rinks in ${duration}ms`);
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Successfully scraped SSPRD events',
        rinkEventCounts: Object.fromEntries(Object.entries(eventsByRink).map(([k, v]) => [k, v.length])),
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      console.error('❌ SSPRD scraper error:', error);
      
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

  private getRinkName(rinkId: string): string {
    const rinkNames: Record<string, string> = {
      'fsc-avalanche': 'Avalanche Rink',
      'fsc-fixit': 'FixIt 24/7 Rink',
      'sssc-rink1': 'Rink 1',
      'sssc-rink2': 'Rink 2',
      'sssc-rink3': 'Rink 3'
    };
    return rinkNames[rinkId] || 'Main Rink';
  }
}

export default {
  async scheduled(_event: unknown, env: Env, _ctx: unknown): Promise<void> {
    // Cron trigger - wake up a random Durable Object instance
    const id = env.SSPRD_SCHEDULER.idFromName('scheduler');
    const obj = env.SSPRD_SCHEDULER.get(id);
    await obj.fetch('https://dummy-url/', { method: 'GET' });
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    // Route requests to the Durable Object
    const id = env.SSPRD_SCHEDULER.idFromName('scheduler');
    const obj = env.SSPRD_SCHEDULER.get(id);
    return obj.fetch(request);
  }
};
