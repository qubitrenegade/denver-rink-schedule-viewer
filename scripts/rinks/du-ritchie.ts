import { RawIceEventData, EventCategory } from '../../src/types.js';
import { BaseScraper } from './base-scraper.js';

interface CalendarEvent {
  uid: string;
  summary: string;
  dtstart: Date;
  dtend: Date;
  description?: string;
  location?: string;
  isAllDay?: boolean;
}

export class DURitchieScraper extends BaseScraper {
  get rinkId(): string { return 'du-ritchie'; }
  get rinkName(): string { return 'DU Ritchie Center'; }

  // Google Calendar IDs from the embed URL (base64 decoded)
  private readonly calendarIds = [
    '4u0hkl9u6ii0o39uk1v90nnv6o@group.calendar.google.com',
    'qtst6uerc2tamp5pbn2p4n4dko@group.calendar.google.com', 
    'pc78u2neckrn16pj4v92r6mufg@group.calendar.google.com',
    '6ej1qanm6fjqmpgkgpu114vijc@group.calendar.google.com'
  ];

  private cleanHtmlDescription(htmlDescription: string): string {
    if (!htmlDescription) return '';
    
    let cleaned = htmlDescription;
    
    // Decode HTML entities
    cleaned = cleaned
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ');
    
    // Remove HTML tags but keep some basic formatting
    cleaned = cleaned
      .replace(/<\/p>/g, '\n\n')           // Paragraphs become double newlines
      .replace(/<\/li>/g, '\n')            // List items become single newlines  
      .replace(/<\/ol>/g, '\n')            // End of ordered list
      .replace(/<\/ul>/g, '\n')            // End of unordered list
      .replace(/<br\s*\/?>/gi, '\n')       // Line breaks
      .replace(/<[^>]*>/g, '')             // Remove all remaining HTML tags
      .replace(/\n{3,}/g, '\n\n')          // Collapse multiple newlines
      .trim();
    
    // Keep only essential info - remove the long registration instructions
    const lines = cleaned.split('\n').filter(line => line.trim());
    const essentialLines = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      // Keep short, useful info
      if (trimmed.length < 200 && (
        trimmed.includes('ages') ||
        trimmed.includes('equipment') ||
        trimmed.includes('helmet') ||
        trimmed.includes('bring') ||
        trimmed.includes('wear')
      )) {
        essentialLines.push(trimmed);
      }
      
      // Stop after we have enough info
      if (essentialLines.length >= 2) break;
    }
    
    return essentialLines.join(' ') || 'Ice session at DU Ritchie Center';
  }

  protected categorizeDUEvent(title: string, description?: string): EventCategory {
    const titleLower = title.toLowerCase().trim();
    
    console.log(`   🏷️ Categorizing: "${title}" (lowercase: "${titleLower}")`);
    
    // Be very explicit about exact matches first
    if (titleLower === 'stick & puck' || titleLower === 'stick and puck') {
      console.log(`     ✅ Exact match: Stick & Puck`);
      return 'Stick & Puck';
    }
    
    if (titleLower === 'public skate') {
      console.log(`     ✅ Exact match: Public Skate`);
      return 'Public Skate';
    }
    
    if (titleLower === 'drop-in hockey' || titleLower === 'drop in hockey') {
      console.log(`     ✅ Exact match: Drop-In Hockey`);
      return 'Drop-In Hockey';
    }
    
    // Then try partial matches
    if (titleLower.includes('stick') && titleLower.includes('puck')) {
      console.log(`     ✅ Partial match: contains "stick" and "puck" -> Stick & Puck`);
      return 'Stick & Puck';
    }
    
    if (titleLower.includes('drop-in') || titleLower.includes('drop in')) {
      console.log(`     ✅ Partial match: contains "drop-in" -> Drop-In Hockey`);
      return 'Drop-In Hockey';
    }
    
    if (titleLower.includes('public') && titleLower.includes('skate')) {
      console.log(`     ✅ Partial match: contains "public skate" -> Public Skate`);
      return 'Public Skate';
    }
    
    if (titleLower.includes('freestyle') || titleLower.includes('figure')) {
      console.log(`     ✅ Partial match: contains "freestyle" or "figure" -> Figure Skating`);
      return 'Figure Skating';
    }
    
    // DU-specific events
    const descLower = (description || '').toLowerCase();
    const combined = `${titleLower} ${descLower}`;
    
    if (combined.includes('pioneer') && combined.includes('practice')) {
      console.log(`     ✅ DU specific: Pioneers practice -> Hockey Practice`);
      return 'Hockey Practice';
    }
    
    if (combined.includes('university') && (combined.includes('practice') || combined.includes('training'))) {
      console.log(`     ✅ DU specific: University practice -> Hockey Practice`);
      return 'Hockey Practice';
    }
    
    if (combined.includes('lesson') || combined.includes('instruction') || combined.includes('learn')) {
      console.log(`     ✅ Learning related -> Learn to Skate`);
      return 'Learn to Skate';
    }
    
    if (combined.includes('closed') || combined.includes('maintenance')) {
      console.log(`     ✅ Closed/maintenance -> Special Event`);
      return 'Special Event';
    }
    
    // Default fallback - but warn about it
    console.log(`     ⚠️ No specific match found for "${title}", defaulting to Public Skate`);
    return 'Public Skate';
  }

  private parseICalDate(dateStr: string, timezone?: string): Date {
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
    let currentTimezone = '';
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      
      while (i + 1 < lines.length && (lines[i + 1].startsWith(' ') || lines[i + 1].startsWith('\t'))) {
        i++;
        line += lines[i].substring(1);
      }
      
      if (line.startsWith('BEGIN:VTIMEZONE')) {
        while (i + 1 < lines.length && !lines[i + 1].startsWith('END:VTIMEZONE')) {
          i++;
          if (lines[i].startsWith('TZID:')) {
            currentTimezone = lines[i].substring(5);
          }
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
        const fieldParams = fieldName.includes(';') ? fieldName.split(';').slice(1) : [];
        const tzParam = fieldParams.find(p => p.startsWith('TZID='));
        const timezone = tzParam ? tzParam.substring(5) : currentTimezone;
        
        switch (baseFieldName) {
          case 'UID':
            currentEvent.uid = fieldValue;
            break;
          case 'SUMMARY':
            currentEvent.summary = fieldValue.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/g, '\n');
            break;
          case 'DTSTART':
            try {
              currentEvent.dtstart = this.parseICalDate(fieldValue, timezone);
              currentEvent.isAllDay = !fieldValue.includes('T');
            } catch (e) {
              console.warn(`      ⚠️ Failed to parse start date: ${fieldValue}`, e);
            }
            break;
          case 'DTEND':
            try {
              currentEvent.dtend = this.parseICalDate(fieldValue, timezone);
            } catch (e) {
              console.warn(`      ⚠️ Failed to parse end date: ${fieldValue}`, e);
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
    try {
      console.log('🏒 Scraping DU Ritchie Center calendars...');
      
      const allEvents: RawIceEventData[] = [];
      
      for (const calendarId of this.calendarIds) {
        try {
          console.log(`   📅 Fetching calendar: ${calendarId.substring(0, 20)}...`);
          
          const icalUrl = `https://calendar.google.com/calendar/ical/${encodeURIComponent(calendarId)}/public/basic.ics`;
          
          const response = await fetch(icalUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
              'Accept': 'text/calendar,*/*',
            }
          });
          
          if (!response.ok) {
            console.warn(`   ⚠️ HTTP ${response.status} for calendar ${calendarId}`);
            continue;
          }
          
          const icalData = await response.text();
          
          if (!icalData.includes('BEGIN:VCALENDAR')) {
            console.warn(`   ⚠️ Invalid iCal data for calendar ${calendarId}`);
            continue;
          }
          
          const events = this.parseICalContent(icalData);
          console.log(`   ✅ Parsed ${events.length} events from calendar`);
          
          // Filter and convert events
          const now = new Date();
          const thirtyDaysFromNow = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
          
          events.forEach((event, index) => {
            // Filter for ice-related events
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
            const category = this.categorizeDUEvent(event.summary, event.description);
            const cleanDescription = event.description ? this.cleanHtmlDescription(event.description) : undefined;
            
            console.log(`   ➕ Adding: "${event.summary}" -> ${category}`);
            
            allEvents.push({
              id: `${this.rinkId}-${eventId}`,
              rinkId: this.rinkId,
              title: this.cleanTitle(event.summary),
              startTime: event.dtstart,
              endTime: event.dtend,
              description: cleanDescription,
              category: category,
              isFeatured: false,
              eventUrl: `https://calendar.google.com/calendar/event?eid=${encodeURIComponent(eventId)}`
            });
          });
          
        } catch (error) {
          console.error(`   ❌ Error fetching calendar ${calendarId}:`, error.message);
        }
      }
      
      console.log(`🏒 DU Ritchie Center: Total events found: ${allEvents.length}`);
      
      // Remove duplicates
      const uniqueEvents = allEvents.filter((event, index, self) => 
        index === self.findIndex((e) => 
          e.title === event.title && 
          e.startTime.getTime() === event.startTime.getTime()
        )
      );
      
      console.log(`🏒 DU Ritchie Center: Unique events after deduplication: ${uniqueEvents.length}`);
      
      // Debug: Show final categorization
      const categoryBreakdown: Record<string, number> = {};
      uniqueEvents.forEach(event => {
        categoryBreakdown[event.category] = (categoryBreakdown[event.category] || 0) + 1;
      });
      
      console.log(`🔍 Final category breakdown:`);
      Object.entries(categoryBreakdown).forEach(([category, count]) => {
        console.log(`   ${category}: ${count}`);
      });
      
      uniqueEvents.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      return uniqueEvents;
      
    } catch (error) {
      console.error('❌ DU Ritchie Center scraping failed:', error);
      return [];
    }
  }
}
