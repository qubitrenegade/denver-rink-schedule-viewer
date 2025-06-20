// workers/scrapers/ssprd.ts - SSPRD scraper with Durable Objects scheduling
import { ScraperHelpers, RawIceEventData } from '../helpers/scraper-helpers';

interface Env {
  RINK_DATA: KVNamespace;
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
    const events: RawIceEventData[] = [];
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

      // Write each rink's events to KV using shared config
      for (const [rinkId, events] of Object.entries(eventsByRink)) {
        await ScraperHelpers.writeToKV(this.env.RINK_DATA, rinkId, events);
      }

      // Create facility-level aggregated data for frontend
      const fscEvents: RawIceEventData[] = [];
      const ssscEvents: RawIceEventData[] = [];
      const fscRinks: {rinkId: string, rinkName: string}[] = [];
      const ssscRinks: {rinkId: string, rinkName: string}[] = [];

      for (const [rinkId, events] of Object.entries(eventsByRink)) {
        if (rinkId.startsWith('fsc-')) {
          fscEvents.push(...events);
          fscRinks.push({ rinkId, rinkName: this.getRinkName(rinkId) });
        } else if (rinkId.startsWith('sssc-')) {
          ssscEvents.push(...events);
          ssscRinks.push({ rinkId, rinkName: this.getRinkName(rinkId) });
        }
      }

      // Write facility-level aggregated data with proper IDs
      if (fscEvents.length > 0) {
        await ScraperHelpers.writeToKV(
          this.env.RINK_DATA,
          'ssprd-fsc',
          fscEvents,
          {
            facilityName: 'Family Sports Center',
            displayName: 'Family Sports Center (Englewood)',
            sourceUrl: 'https://ssprd.finnlyconnect.com/schedule/249',
            rinkName: 'Family Sports Center'
          }
        );

        // Write custom aggregated metadata for FSC
        const fscMetadata: any = {
          facilityId: 'ssprd-fsc',
          facilityName: 'Family Sports Center',
          displayName: 'Family Sports Center (Englewood)',
          lastAttempt: new Date().toISOString(),
          status: 'success',
          eventCount: fscEvents.length,
          sourceUrl: 'https://ssprd.finnlyconnect.com/schedule/249',
          rinks: fscRinks,
          lastSuccessfulScrape: new Date().toISOString()
        };
        await this.env.RINK_DATA.put(`metadata:ssprd-fsc`, JSON.stringify(fscMetadata));
      }

      if (ssscEvents.length > 0) {
        await ScraperHelpers.writeToKV(
          this.env.RINK_DATA,
          'ssprd-sssc',
          ssscEvents,
          {
            facilityName: 'South Suburban Sports Complex',
            displayName: 'South Suburban Sports Complex (Highlands Ranch)',
            sourceUrl: 'https://ssprd.finnlyconnect.com/schedule/250',
            rinkName: 'South Suburban Sports Complex'
          }
        );

        // Write custom aggregated metadata for SSSC
        const ssscMetadata: any = {
          facilityId: 'ssprd-sssc',
          facilityName: 'South Suburban Sports Complex',
          displayName: 'South Suburban Sports Complex (Highlands Ranch)',
          lastAttempt: new Date().toISOString(),
          status: 'success',
          eventCount: ssscEvents.length,
          sourceUrl: 'https://ssprd.finnlyconnect.com/schedule/250',
          rinks: ssscRinks,
          lastSuccessfulScrape: new Date().toISOString()
        };
        await this.env.RINK_DATA.put(`metadata:ssprd-sssc`, JSON.stringify(ssscMetadata));
      }

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
  async fetch(request: Request, env: Env): Promise<Response> {
    // Route requests to the Durable Object
    const id = env.SSPRD_SCHEDULER.idFromName('scheduler');
    const obj = env.SSPRD_SCHEDULER.get(id);
    return obj.fetch(request);
  }
  
  // Cron scheduling removed - now managed by centralized scheduler
};
