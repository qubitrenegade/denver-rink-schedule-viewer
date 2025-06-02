// workers/scrapers/foothills-edge.ts - Cloudflare Worker for Foothills Edge Ice Arena
// Scrapes events from the Edge calendar and stores in KV

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

class FoothillsEdgeScraper {
  private readonly rinkId = 'foothills-edge';
  private readonly rinkName = 'Foothills Ice Arena (Edge)';
  private readonly calendarUrl = 'https://calendar.ifoothills.org/calendars/edge-ice-arena-drop.php';

  private cleanTitle(rawTitle: string): string {
    let cleanTitle = rawTitle.trim();
    cleanTitle = cleanTitle.replace(/^\d{1,2}([A-Za-z])/, '$1');
    cleanTitle = cleanTitle.replace(/^-\s*/, '');
    cleanTitle = cleanTitle.replace(/register/gi, '');
    cleanTitle = cleanTitle.replace(/click here/gi, '');
    cleanTitle = cleanTitle.replace(/^\W+/, '');
    return cleanTitle.trim();
  }

  private categorizeEvent(title: string): string {
    const titleLower = title.toLowerCase().trim();
    if (titleLower.includes('drop') && titleLower.includes('hockey')) return 'Drop-In Hockey';
    if (titleLower.includes('stick') && titleLower.includes('puck')) return 'Stick & Puck';
    if (titleLower.includes('public skate')) return 'Public Skate';
    if (titleLower.includes('figure skating') || titleLower.includes('freestyle')) return 'Figure Skating';
    if (titleLower.includes('learn to skate') || titleLower.includes('skating lessons')) return 'Learn to Skate';
    if (titleLower.includes('hockey practice') || titleLower.includes('practice')) return 'Hockey Practice';
    if (titleLower.includes('hockey league') || titleLower.includes('league')) return 'Hockey League';
    if (titleLower.includes('closed') || titleLower.includes('maintenance')) return 'Special Event';
    return 'Other';
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
        'User-Agent': 'Mozilla/5.0 (compatible; DenverRinkScheduler/1.0)'
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

function getRandomDelay(maxMinutes: number = 60): number {
  return Math.floor(Math.random() * maxMinutes * 60 * 1000);
}

async function writeToKV(env: Env, rinkId: string, events: RawIceEventData[]): Promise<void> {
  await env.RINK_DATA.put(`events:${rinkId}`, JSON.stringify(events));
  const metadata: FacilityMetadata = {
    facilityId: rinkId,
    facilityName: 'Foothills Ice Arena (Edge)',
    displayName: 'Foothills Ice Arena (Edge)',
    lastAttempt: new Date().toISOString(),
    status: 'success',
    eventCount: events.length,
    sourceUrl: 'https://calendar.ifoothills.org/calendars/edge-ice-arena-drop.php',
    rinks: [{ rinkId, rinkName: 'Main Rink' }],
    lastSuccessfulScrape: new Date().toISOString()
  };
  await env.RINK_DATA.put(`metadata:${rinkId}`, JSON.stringify(metadata));
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const delay = getRandomDelay(60);
    await new Promise(resolve => setTimeout(resolve, delay));
    try {
      const scraper = new FoothillsEdgeScraper();
      const events = await scraper.scrape();
      await writeToKV(env, 'foothills-edge', events);
    } catch (error) {
      const errorMetadata: FacilityMetadata = {
        facilityId: 'foothills-edge',
        facilityName: 'Foothills Ice Arena (Edge)',
        displayName: 'Foothills Ice Arena (Edge)',
        lastAttempt: new Date().toISOString(),
        status: 'error',
        eventCount: 0,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        sourceUrl: 'https://calendar.ifoothills.org/calendars/edge-ice-arena-drop.php',
        rinks: [{ rinkId: 'foothills-edge', rinkName: 'Main Rink' }]
      };
      await env.RINK_DATA.put(`metadata:foothills-edge`, JSON.stringify(errorMetadata));
      throw error;
    }
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'POST') {
      try {
        const scraper = new FoothillsEdgeScraper();
        const events = await scraper.scrape();
        await writeToKV(env, 'foothills-edge', events);
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
    return new Response('Foothills Edge Scraper Worker - Use POST to trigger scraping', {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};
