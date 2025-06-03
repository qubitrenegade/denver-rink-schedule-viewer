// workers/scrapers/du-ritchie.ts - DU Ritchie scraper with Durable Objects scheduling
import { ScraperHelpers, RawIceEventData } from '../helpers/scraper-helpers';

interface Env {
  RINK_DATA: KVNamespace;
  DU_RITCHIE_SCHEDULER: DurableObjectNamespace;
  SCRAPER_SPLAY_MINUTES: string;
}

interface CalendarEvent {
  uid: string;
  summary: string;
  dtstart: Date;
  dtend: Date;
  description?: string;
  location?: string;
  isAllDay?: boolean;
}

class DURitchieScraper {
  private readonly rinkId = 'du-ritchie';
  private readonly rinkName = 'DU Ritchie Center';

  // Google Calendar IDs from the embed URL (base64 decoded)
  private readonly calendarIds = [
    '4u0hkl9u6ii0o39uk1v90nnv6o@group.calendar.google.com',
    'qtst6uerc2tamp5pbn2p4n4dko@group.calendar.google.com',
    'pc78u2neckrn16pj4v92r6mufg@group.calendar.google.com',
    '6ej1qanm6fjqmpgkgpu114vijc@group.calendar.google.com'
  ];

  private cleanTitle(rawTitle: string): string {
    return ScraperHelpers.cleanTitle(rawTitle);
  }

  private categorizeEvent(title: string): string {
    return ScraperHelpers.categorizeEvent(title);
  }

  private cleanHtmlDescription(htmlDescription: string): string {
    if (!htmlDescription) return '';
    
    let cleaned = htmlDescription
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/<\/p>/g, '\n\n')
      .replace(/<\/li>/g, '\n')
      .replace(/<\/ol>/g, '\n')
      .replace(/<\/ul>/g, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    
    const lines = cleaned.split('\n').filter(line => line.trim());
    const essentialLines = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      if (trimmed.length < 200 && (
        trimmed.includes('ages') ||
        trimmed.includes('equipment') ||
        trimmed.includes('helmet') ||
        trimmed.includes('bring') ||
        trimmed.includes('wear')
      )) {
        essentialLines.push(trimmed);
      }
      
      if (essentialLines.length >= 2) break;
    }
    
    return essentialLines.join(' ') || 'Ice session at DU Ritchie Center';
  }

  private parseICalDate(dateStr: string): Date {
    if (dateStr.includes('T')) {
      const year = parseInt(dateStr.substr(0, 4));
      const month = parseInt(dateStr.substr(4, 2)) - 1;
      const day = parseInt(dateStr.substr(6, 2));
      const hour = parseInt(dateStr.substr(9, 2));
      const minute = parseInt(dateStr.substr(11, 2));
      const second = parseInt(dateStr.substr(13, 2));
      
      if (dateStr.endsWith('Z')) {
        return new Date(Date.UTC(year, month, day, hour, minute, second));
      } else {
        return new Date(year, month, day, hour, minute, second);
      }
    } else {
      const year = parseInt(dateStr.substr(0, 4));
      const month = parseInt(dateStr.substr(4, 2)) - 1;
      const day = parseInt(dateStr.substr(6, 2));
      return new Date(year, month, day, 12, 0, 0);
    }
  }

  private parseICalContent(icalData: string): CalendarEvent[] {
    const events: CalendarEvent[] = [];
    const lines = icalData.split(/\r?\n/);
    
    let currentEvent: Partial<CalendarEvent> | null = null;
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      
      while (i + 1 < lines.length && (lines[i + 1].startsWith(' ') || lines[i + 1].startsWith('\t'))) {
        i++;
        line += lines[i].substring(1);
      }
      
      if (line.startsWith('BEGIN:VTIMEZONE')) {
        while (i + 1 < lines.length && !lines[i + 1].startsWith('END:VTIMEZONE')) {
          i++;
        }
      } else if (line === 'BEGIN:VEVENT') {
        currentEvent = {};
      } else if (line === 'END:VEVENT' && currentEvent) {
        if (currentEvent.summary && currentEvent.dtstart && currentEvent.dtend) {
          events.push(currentEvent as CalendarEvent);
        }
        currentEvent = null;
      } else if (currentEvent && line.includes(':')) {
        const colonIndex = line.indexOf(':');
        const fieldName = line.substring(0, colonIndex);
        const fieldValue = line.substring(colonIndex + 1);
        
        const baseFieldName = fieldName.split(';')[0];
        
        switch (baseFieldName) {
          case 'UID':
            currentEvent.uid = fieldValue;
            break;
          case 'SUMMARY':
            currentEvent.summary = fieldValue.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/g, '\n');
            break;
          case 'DTSTART':
            try {
              currentEvent.dtstart = this.parseICalDate(fieldValue);
              currentEvent.isAllDay = !fieldValue.includes('T');
            } catch (e) {
              console.warn(`Failed to parse start date: ${fieldValue}`, e);
            }
            break;
          case 'DTEND':
            try {
              currentEvent.dtend = this.parseICalDate(fieldValue);
            } catch (e) {
              console.warn(`Failed to parse end date: ${fieldValue}`, e);
            }
            break;
          case 'DESCRIPTION':
            currentEvent.description = fieldValue.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/g, '\n');
            break;
          case 'LOCATION':
            currentEvent.location = fieldValue.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/g, '\n');
            break;
        }
      }
    }
    
    return events;
  }

  async scrape(): Promise<RawIceEventData[]> {
    console.log(`🏫 Scraping DU Ritchie Center events...`);
    const allEvents: RawIceEventData[] = [];
    
    for (const calendarId of this.calendarIds) {
      try {
        const icalUrl = `https://calendar.google.com/calendar/ical/${encodeURIComponent(calendarId)}/public/basic.ics`;
        
        const response = await fetch(icalUrl, {
          headers: {
            'User-Agent': ScraperHelpers.getUserAgent(),
            'Accept': 'text/calendar,*/*',
          }
        });
        
        if (!response.ok) {
          console.warn(`HTTP ${response.status} for calendar ${calendarId}`);
          continue;
        }
        
        const icalData = await response.text();
        
        if (!icalData.includes('BEGIN:VCALENDAR')) {
          console.warn(`Invalid iCal data for calendar ${calendarId}`);
          continue;
        }
        
        const events = this.parseICalContent(icalData);
        
        const now = new Date();
        const thirtyDaysFromNow = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
        
        events.forEach((event, index) => {
          const title = event.summary.toLowerCase();
          
          if (title.includes('basketball') || 
              title.includes('meeting') ||
              title.includes('conference') && !title.includes('ice') && !title.includes('hockey') && !title.includes('skate') ||
              title.includes('graduation') || 
              title.includes('commencement')) {
            return;
          }
          
          if (event.dtstart < now || event.dtstart > thirtyDaysFromNow) {
            return;
          }
          
          const eventId = event.uid || `du-ritchie-${event.dtstart.getTime()}-${index}`;
          const category = this.categorizeEvent(event.summary);
          const cleanDescription = event.description ? this.cleanHtmlDescription(event.description) : undefined;
          
          allEvents.push({
            id: `${this.rinkId}-${eventId}`,
            rinkId: this.rinkId,
            title: this.cleanTitle(event.summary),
            startTime: event.dtstart.toISOString(),
            endTime: event.dtend.toISOString(),
            description: cleanDescription,
            category: category,
            isFeatured: false,
            eventUrl: `https://calendar.google.com/calendar/event?eid=${encodeURIComponent(eventId)}`
          });
        });
        
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Error fetching calendar ${calendarId}:`, message);
      }
    }
    
    // Remove duplicates and apply filters
    const uniqueEvents = allEvents.filter((event, index, self) => 
      index === self.findIndex((e) => 
        e.title === event.title && 
        e.startTime === event.startTime
      )
    );

    // Sort events by start time and filter to next 30 days
    const sortedEvents = ScraperHelpers.sortEventsByTime(uniqueEvents);
    const filteredEvents = ScraperHelpers.filterEventsToNext30Days(sortedEvents);

    console.log(`🏫 DU Ritchie: Found ${filteredEvents.length} events`);
    return filteredEvents;
  }
}

// Durable Object for scheduling DU Ritchie scraper
export class DURitchieScheduler {
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
      'du-ritchie',
      () => this.runScraper()
    );
  }

  async alarm(): Promise<void> {
    return ScraperHelpers.handleSchedulerAlarm(
      this.state,
      this.env,
      'du-ritchie',
      () => this.runScraper()
    );
  }

  private async runScraper(): Promise<Response> {
    const startTime = Date.now();
    
    try {
      console.log('🔧 DU Ritchie scraper triggered');
      const scraper = new DURitchieScraper();
      const events = await scraper.scrape();
      
      await ScraperHelpers.writeToKV(this.env.RINK_DATA, 'du-ritchie', events, {
        facilityName: 'DU Ritchie Center',
        displayName: 'DU Ritchie Center (Denver)',
        sourceUrl: 'https://ritchiecenter.du.edu/sports/ice-programs',
        rinkName: 'Main Rink'
      });

      // Update last run time
      await this.state.storage.put('lastRun', new Date().toISOString());

      const duration = Date.now() - startTime;
      console.log(`✅ DU Ritchie scraping completed in ${duration}ms`);

      return ScraperHelpers.jsonResponse({
        success: true,
        eventCount: events.length,
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`,
        message: `Successfully scraped ${events.length} events`
      });

    } catch (error) {
      console.error('❌ DU Ritchie scraping failed:', error);
      
      await ScraperHelpers.writeErrorMetadata(this.env.RINK_DATA, 'du-ritchie', error, {
        facilityName: 'DU Ritchie Center',
        displayName: 'DU Ritchie Center (Denver)',
        sourceUrl: 'https://ritchiecenter.du.edu/sports/ice-programs',
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
    const id = env.DU_RITCHIE_SCHEDULER.idFromName('du-ritchie');
    const stub = env.DU_RITCHIE_SCHEDULER.get(id);
    
    return stub.fetch(request);
  },

  async scheduled(_event: unknown, env: Env, _ctx: unknown): Promise<void> {
    console.log(`🕐 DU Ritchie cron triggered at ${new Date().toISOString()}`);
    
    // Get the Durable Object and trigger scheduling
    const id = env.DU_RITCHIE_SCHEDULER.idFromName('du-ritchie');
    const stub = env.DU_RITCHIE_SCHEDULER.get(id);
    
    // Call the GET endpoint to schedule an alarm
    await stub.fetch(new Request('https://fake.url/', { method: 'GET' }));
  }
};

