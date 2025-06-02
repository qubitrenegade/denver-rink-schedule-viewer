// workers/scrapers/ssprd.ts - SSPRD scraper worker (Cloudflare Worker compatible)
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
    const titleLower = title.toLowerCase();
    if (titleLower.includes('closed') || titleLower.includes('holiday') || titleLower.includes('memorial')) return 'Special Event';
    if (titleLower.includes('public skate') || titleLower.includes('open skate')) return 'Public Skate';
    if (titleLower.includes('stick') && titleLower.includes('puck')) return 'Stick & Puck';
    if (titleLower.includes('take a shot')) return 'Stick & Puck';
    if (titleLower.includes('drop') || titleLower.includes('pickup')) return 'Drop-In Hockey';
    if (titleLower.includes('learn') || titleLower.includes('lesson') || titleLower.includes('lts')) return 'Learn to Skate';
    if (titleLower.includes('freestyle') || titleLower.includes('figure')) return 'Figure Skating';
    if (titleLower.includes('practice') || titleLower.includes('training')) return 'Hockey Practice';
    if (titleLower.includes('league') || titleLower.includes('game')) return 'Hockey League';
    if (titleLower.includes('broomball') || titleLower.includes('special')) return 'Special Event';
    return 'Other';
  }

  async scrape(): Promise<RawIceEventData[]> {
    const response = await fetch(this.schedulePageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DenverRinkScheduler/1.0)'
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

function getRandomDelay(maxMinutes: number = 60): number {
  return Math.floor(Math.random() * maxMinutes * 60 * 1000);
}

async function writeRinkEventsToKV(env: Env, rinkId: string, events: RawIceEventData[], sourceUrl: string) {
  await env.RINK_DATA.put(`events:${rinkId}`, JSON.stringify(events));
  const metadata: FacilityMetadata = {
    facilityId: rinkId,
    facilityName: rinkId.startsWith('fsc-') ? 'SSPRD Family Sports' : 'SSPRD South Suburban',
    displayName: rinkId,
    lastAttempt: new Date().toISOString(),
    status: 'success',
    eventCount: events.length,
    sourceUrl,
    rinks: [{ rinkId, rinkName: 'Main Rink' }],
    lastSuccessfulScrape: new Date().toISOString()
  };
  await env.RINK_DATA.put(`metadata:${rinkId}`, JSON.stringify(metadata));
  console.log(`💾 Stored ${events.length} events and metadata for ${rinkId}`);
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log(`🕐 SSPRD scraper triggered at ${new Date().toISOString()}`);
    const delay = getRandomDelay(60);
    console.log(`⏱️ Waiting ${Math.floor(delay / 1000 / 60)} minutes before scraping...`);
    await new Promise(resolve => setTimeout(resolve, delay));
    try {
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
      for (const rinkId of Object.keys(eventsByRink)) {
        await writeRinkEventsToKV(env, rinkId, eventsByRink[rinkId], 'https://ssprd.finnlyconnect.com');
      }
      console.log(`✅ SSPRD scraping completed for rinks: ${Object.keys(eventsByRink).join(', ')}`);
    } catch (error) {
      console.error(`❌ SSPRD scraping failed:`, error);
      // Write error metadata for all rinks
      for (const rinkId of Object.values(facilityIdToRinkIdMap)) {
        const errorMetadata: FacilityMetadata = {
          facilityId: rinkId,
          facilityName: rinkId.startsWith('fsc-') ? 'SSPRD Family Sports' : 'SSPRD South Suburban',
          displayName: rinkId,
          lastAttempt: new Date().toISOString(),
          status: 'error',
          eventCount: 0,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          sourceUrl: 'https://ssprd.finnlyconnect.com',
          rinks: [{ rinkId, rinkName: 'Main Rink' }]
        };
        await env.RINK_DATA.put(`metadata:${rinkId}`, JSON.stringify(errorMetadata));
      }
      throw error;
    }
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'POST') {
      try {
        console.log('🔧 Manual trigger received');
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
        for (const rinkId of Object.keys(eventsByRink)) {
          await writeRinkEventsToKV(env, rinkId, eventsByRink[rinkId], 'https://ssprd.finnlyconnect.com');
        }
        return new Response(JSON.stringify({
          success: true,
          message: 'Successfully scraped SSPRD events',
          rinkEventCounts: Object.fromEntries(Object.entries(eventsByRink).map(([k, v]) => [k, v.length])),
          timestamp: new Date().toISOString()
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
    return new Response('SSPRD Scraper Worker - Use POST to trigger scraping', {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};
