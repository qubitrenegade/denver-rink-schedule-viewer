// workers/scrapers/big-bear.ts - Big Bear scraper with Durable Objects scheduling
import { ScraperHelpers, RawIceEventData } from '../helpers/scraper-helpers';

interface Env {
  RINK_DATA: KVNamespace;
  BIG_BEAR_SCHEDULER: DurableObjectNamespace;
  SCRAPER_SPLAY_MINUTES: string;
}

class BigBearScraper {
  private readonly rinkId = 'big-bear';
  private readonly rinkName = 'Big Bear Ice Arena';
  private readonly baseUrl = 'https://bigbearicearena.ezfacility.com';

  private getTodayString(offsetDays: number = 0): string {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
  }

  async scrape(): Promise<RawIceEventData[]> {
    console.log(`🧊 Scraping Big Bear events...`);

    const url = `${this.baseUrl}/Sessions/FilterResults`;
    const formData = new URLSearchParams({
      LocationId: '13558',
      Sunday: 'true', Monday: 'true', Tuesday: 'true', Wednesday: 'true', Thursday: 'true', Friday: 'true', Saturday: 'true',
      StartTime: '12:00 AM',
      EndTime: '12:00 AM',
      'ReservationTypes[0].Selected': 'true', 'ReservationTypes[0].Id': '-1',
      'ReservationTypes[1].Id': '203425', 'ReservationTypes[2].Id': '208508', 'ReservationTypes[3].Id': '215333',
      'ReservationTypes[4].Id': '182117', 'ReservationTypes[5].Id': '227573', 'ReservationTypes[6].Id': '217778',
      'ReservationTypes[7].Id': '215383', 'ReservationTypes[8].Id': '271335', 'ReservationTypes[9].Id': '285107',
      'ReservationTypes[10].Id': '218387', 'ReservationTypes[11].Id': '215334', 'ReservationTypes[12].Id': '190860',
      'ReservationTypes[13].Id': '215332', 'ReservationTypes[14].Id': '224028',
      'Resources[0].Selected': 'true', 'Resources[0].Id': '-1', 'Resources[1].Id': '268382', 'Resources[2].Id': '268383',
      'Resources[3].Id': '309500', 'Resources[4].Id': '350941', 'Resources[5].Id': '354858', 'Resources[6].Id': '396198',
      StartDate: this.getTodayString(-3), EndDate: this.getTodayString(32)
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': ScraperHelpers.getUserAgent()
      },
      body: formData.toString()
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const eventsJson = await response.json();
    if (!Array.isArray(eventsJson)) {
      throw new Error('Big Bear API did not return an array');
    }

    const events: RawIceEventData[] = eventsJson.map((ev: any) => {
      // The API returns times in Mountain Time (MT), but Date parses as UTC. To store as UTC, add 6 hours.
      const startTime = new Date(ev.start);
      startTime.setHours(startTime.getHours() + 6);
      const endTime = new Date(ev.end);
      endTime.setHours(endTime.getHours() + 6);

      // Extract rink name from resourceName or venues (for future use if needed)
      // const rawRinkName = ev.resourceName || (ev.venues && ev.venues[0]?.Name) || 'Main Rink';

      // Clean title
      const title = ScraperHelpers.cleanTitle(ev.title || '');
      const category = ScraperHelpers.categorizeEvent(title);

      // Extract rink name from resourceName field
      const rawRinkName = ev.resourceName || 'Main Rink';
      let rinkId = this.rinkId;

      // Map resourceName to specific rink IDs
      if (rawRinkName === 'North Rink') {
        rinkId = 'big-bear-north';
      } else if (rawRinkName === 'South Rink') {
        rinkId = 'big-bear-south';
      }

      // Parse and clean description
      let cleanedDescription = '';

      if (ev.description) {
        const desc = ev.description.trim();

        cleanedDescription = desc;

        // Clean up redundant information from description
        cleanedDescription = cleanedDescription
          // Remove session name if it matches or is similar to the title
          .replace(new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*,?\\s*`, 'i'), '')
          .replace(/^Free\s*Style\s*Session\s*,?\s*/i, '') // Handle "Free Style Session" vs "Freestyle"
          .replace(/^Freestyle\s*Session\s*,?\s*/i, '')
          .replace(/^Open\s*Sick\s*and\s*Puck\s*,?\s*/i, '')
          .replace(/^Open\s*Stick\s*and\s*Puck\s*,?\s*/i, '')
          .replace(/^Public\s*Skate\s*,?\s*/i, '')
          .replace(/^Drop-?In\s*Hockey\s*,?\s*/i, '')
          // Remove duration information since it's in the time field
          .replace(/,?\s*\d+\s*Minutes?\s*long\s*,?\s*/i, '')
          .replace(/,?\s*\(\d+\s*min\)\s*,?\s*/i, '')
          // Clean up extra commas and whitespace
          .replace(/^,\s*/, '')
          .replace(/,\s*,/g, ',')
          .replace(/\s+/g, ' ')
          .trim();

        // If description is now empty or just punctuation, set to empty
        if (!cleanedDescription || /^[,.\s]*$/.test(cleanedDescription)) {
          cleanedDescription = '';
        }
      }

      return {
        id: `${rinkId}-${ev.id}`,
        rinkId,
        title,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        description: cleanedDescription,
        category,
        isFeatured: false,
        eventUrl: undefined
      };
    });

    // Sort events by start time and filter to next 30 days
    const sortedEvents = ScraperHelpers.sortEventsByTime(events);
    const filteredEvents = ScraperHelpers.filterEventsToNext30Days(sortedEvents);

    console.log(`🧊 Big Bear: Found ${filteredEvents.length} events`);
    return filteredEvents;
  }
}

// Durable Object for scheduling Big Bear scraper
export class BigBearScheduler {
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
      'big-bear',
      () => this.runScraper()
    );
  }

  async alarm(): Promise<void> {
    return ScraperHelpers.handleSchedulerAlarm(
      this.state,
      this.env,
      'big-bear',
      () => this.runScraper()
    );
  }

  private async runScraper(): Promise<Response> {
    const startTime = Date.now();

    try {
      console.log('🔧 Big Bear scraper triggered');
      const scraper = new BigBearScraper();
      const events = await scraper.scrape();

      // Separate events by rink for individual rink storage
      const eventsByRink: Record<string, RawIceEventData[]> = {
        'big-bear-north': [],
        'big-bear-south': []
      };

      // Group events by rink
      events.forEach(event => {
        if (event.rinkId === 'big-bear-north') {
          eventsByRink['big-bear-north'].push(event);
        } else if (event.rinkId === 'big-bear-south') {
          eventsByRink['big-bear-south'].push(event);
        }
      });

      // Write each individual rink's events to KV using shared config
      for (const [rinkId, rinkEvents] of Object.entries(eventsByRink)) {
        if (rinkEvents.length > 0) {
          await ScraperHelpers.writeToKV(this.env.RINK_DATA, rinkId, rinkEvents);
        }
      }

      // Create facility-level aggregated data for frontend
      const bigBearRinks: {rinkId: string, rinkName: string}[] = [];
      if (eventsByRink['big-bear-north'].length > 0) {
        bigBearRinks.push({ rinkId: 'big-bear-north', rinkName: 'North Rink' });
      }
      if (eventsByRink['big-bear-south'].length > 0) {
        bigBearRinks.push({ rinkId: 'big-bear-south', rinkName: 'South Rink' });
      }

      // Write facility-level aggregated data - ALL events combined for the big-bear endpoint
      if (events.length > 0) {
        await ScraperHelpers.writeToKV(
          this.env.RINK_DATA,
          'big-bear',
          events,
          {
            facilityName: 'Big Bear Ice Arena',
            displayName: 'Big Bear Ice Arena (Lowry)',
            sourceUrl: 'https://bigbearicearena.ezfacility.com/Sessions',
            rinkName: 'Big Bear Ice Arena'
          }
        );

        // Write custom aggregated metadata for Big Bear
        const bigBearMetadata: any = {
          facilityId: 'big-bear',
          facilityName: 'Big Bear Ice Arena',
          displayName: 'Big Bear Ice Arena (Lowry)',
          lastAttempt: new Date().toISOString(),
          status: 'success',
          eventCount: events.length,
          sourceUrl: 'https://bigbearicearena.ezfacility.com/Sessions',
          rinks: bigBearRinks,
          lastSuccessfulScrape: new Date().toISOString()
        };
        await this.env.RINK_DATA.put(`metadata:big-bear`, JSON.stringify(bigBearMetadata));
      }

      // Update last run time
      await this.state.storage.put('lastRun', new Date().toISOString());

      const duration = Date.now() - startTime;
      console.log(`✅ Big Bear scraping completed in ${duration}ms - ${events.length} total events across ${bigBearRinks.length} rinks`);

      return ScraperHelpers.jsonResponse({
        success: true,
        eventCount: events.length,
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`,
        message: `Successfully scraped ${events.length} events across ${bigBearRinks.length} rinks`
      });

    } catch (error) {
      console.error('❌ Big Bear scraping failed:', error);

      await ScraperHelpers.writeErrorMetadata(this.env.RINK_DATA, 'big-bear', error);

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
    const id = env.BIG_BEAR_SCHEDULER.idFromName('big-bear');
    const stub = env.BIG_BEAR_SCHEDULER.get(id);

    return stub.fetch(request);
  }
  
  // Cron scheduling removed - now managed by centralized scheduler
};

