// workers/scrapers/du-ritchie.ts - DU Ritchie scraper worker
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
    
    if (titleLower === 'stick & puck' || titleLower === 'stick and puck') {
      return 'Stick & Puck';
    }
    if (titleLower === 'public skate') {
      return 'Public Skate';
    }
    if (titleLower === 'drop-in hockey' || titleLower === 'drop in hockey') {
      return 'Drop-In Hockey';
    }
    if (titleLower.includes('stick') && titleLower.includes('puck')) {
      return 'Stick & Puck';
    }
    if (titleLower.includes('public skate')) {
      return 'Public Skate';
    }
    if (titleLower.includes('drop') && titleLower.includes('hockey')) {
      return 'Drop-In Hockey';
    }
    if (titleLower.includes('league')) {
      return 'Hockey League';
    }
    if (titleLower.includes('figure') || titleLower.includes('freestyle')) {
      return 'Figure Skating';
    }
    if (titleLower.includes('learn') || titleLower.includes('lesson')) {
      return 'Learn to Skate';
    }
    if (titleLower.includes('practice')) {
      return 'Hockey Practice';
    }
    if (titleLower.includes('closed') || titleLower.includes('holiday')) {
      return 'Special Event';
    }
    
    return 'Other';
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
            'User-Agent': 'Mozilla/5.0 (compatible; DenverRinkScheduler/1.0)',
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
    
    // Remove duplicates
    const uniqueEvents = allEvents.filter((event, index, self) => 
      index === self.findIndex((e) => 
        e.title === event.title && 
        e.startTime === event.startTime
      )
    );
    
    uniqueEvents.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    return uniqueEvents;
  }
}

function getRandomDelay(maxMinutes: number = 60): number {
  return Math.floor(Math.random() * maxMinutes * 60 * 1000);
}

async function writeToKV(env: Env, rinkId: string, events: RawIceEventData[]): Promise<void> {
  await env.RINK_DATA.put(`events:${rinkId}`, JSON.stringify(events));
  
  const metadata: FacilityMetadata = {
    facilityId: rinkId,
    facilityName: 'DU Ritchie Center',
    displayName: 'DU Ritchie Center (Denver)',
    lastAttempt: new Date().toISOString(),
    status: 'success',
    eventCount: events.length,
    sourceUrl: 'https://ritchiecenter.du.edu/sports/ice-programs',
    rinks: [{ rinkId, rinkName: 'Main Rink' }],
    lastSuccessfulScrape: new Date().toISOString()
  };
  
  await env.RINK_DATA.put(`metadata:${rinkId}`, JSON.stringify(metadata));
  console.log(`💾 Stored ${events.length} events and metadata for ${rinkId}`);
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log(`🕐 DU Ritchie scraper triggered at ${new Date().toISOString()}`);
    
    const delay = getRandomDelay(60);
    console.log(`⏱️ Waiting ${Math.floor(delay / 1000 / 60)} minutes before scraping...`);
    await new Promise(resolve => setTimeout(resolve, delay));
    
    try {
      const scraper = new DURitchieScraper();
      const events = await scraper.scrape();
      await writeToKV(env, 'du-ritchie', events);
      console.log(`✅ DU Ritchie scraping completed successfully: ${events.length} events`);
    } catch (error) {
      console.error(`❌ DU Ritchie scraping failed:`, error);
      
      const errorMetadata: FacilityMetadata = {
        facilityId: 'du-ritchie',
        facilityName: 'DU Ritchie Center',
        displayName: 'DU Ritchie Center (Denver)',
        lastAttempt: new Date().toISOString(),
        status: 'error',
        eventCount: 0,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        sourceUrl: 'https://ritchiecenter.du.edu/sports/ice-programs',
        rinks: [{ rinkId: 'du-ritchie', rinkName: 'Main Rink' }]
      };
      
      await env.RINK_DATA.put(`metadata:du-ritchie`, JSON.stringify(errorMetadata));
      throw error;
    }
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'POST') {
      try {
        console.log('🔧 Manual trigger received');
        const scraper = new DURitchieScraper();
        const events = await scraper.scrape();
        await writeToKV(env, 'du-ritchie', events);
        
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
    
    return new Response('DU Ritchie Scraper Worker - Use POST to trigger scraping', { 
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};

