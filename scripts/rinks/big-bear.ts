import { RawIceEventData, EventCategory } from '../../src/types.js';
import { BaseScraper } from './base-scraper.js';

interface BigBearEvent {
  id: string;
  parentEventId?: string; // ReservationID
  title: string;
  start: string; // "YYYY-MM-DDTHH:mm:ss" - Facility local time
  end: string;   // "YYYY-MM-DDTHH:mm:ss" - Facility local time
  allDay: boolean;
  className: string[]; // e.g., ["event-purple", "PublicSessions"]
  description?: string;
  spotsLeft?: number;
  maxClassSize?: number;
  viewOnly?: boolean;
  clientFullName?: string; // Instructor
  clientIds?: string;
  videoUrl?: string;
  url?: string; // e.g., "/Sessions/BookReservationJson/ID"
}

export class BigBearScraper extends BaseScraper {
  get rinkId(): string { return 'big-bear'; }
  get rinkName(): string { return 'Big Bear Ice Arena'; }

  private readonly baseUrl = 'https://bigbearicearena.ezfacility.com';

  protected categorizeBigBearEvent(event: BigBearEvent): EventCategory {
    const classNames = event.className.join(' ').toLowerCase();
    const titleLower = event.title.toLowerCase();

    if (classNames.includes('event-purple') || titleLower.includes('public skate')) return 'Public Skate';
    if (classNames.includes('event-pink') || titleLower.includes('freestyle')) return 'Figure Skating';
    if (classNames.includes('event-green') || (titleLower.includes('stick') && titleLower.includes('puck'))) return 'Stick & Puck';
    if (classNames.includes('event-red') || titleLower.includes('drop-in') || titleLower.includes('drop in')) return 'Drop-In Hockey';
    if (classNames.includes('event-navy') || titleLower.includes('party room')) return 'Special Event'; // Party Room
    if (classNames.includes('event-gold') || titleLower.includes('hockey party')) return 'Special Event'; // Hockey Party Room
    
    // Fallback to general title categorization
    return this.categorizeEvent(event.title);
  }

  async scrape(): Promise<RawIceEventData[]> {
    try {
      console.log('🐻 Scraping Big Bear Ice Arena...');
      
      // First, let's try to get a session by visiting the main sessions page
      const mainPageUrl = `${this.baseUrl}/Sessions`;
      console.log(`   🔄 Getting session from main page: ${mainPageUrl}`);
      
      const mainPageHtml = await this.fetchWithFallback(mainPageUrl);
      
      // Extract any cookies or session info we might need
      // For now, let's try the API with proper headers that mimic a browser
      
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth(); // 0-indexed

      const startDateCurrentMonth = new Date(year, month, 1);
      const endDateCurrentMonth = new Date(year, month + 1, 0); 
      
      const startDateNextMonth = new Date(year, month + 1, 1);
      const endDateNextMonth = new Date(year, month + 2, 0);
      
      const formatDateForAPI = (date: Date) => date.toISOString().split('T')[0];

      const eventsUrl1 = `${this.baseUrl}/Sessions/GetCalenderEvents?start=${formatDateForAPI(startDateCurrentMonth)}&end=${formatDateForAPI(endDateCurrentMonth)}`;
      const eventsUrl2 = `${this.baseUrl}/Sessions/GetCalenderEvents?start=${formatDateForAPI(startDateNextMonth)}&end=${formatDateForAPI(endDateNextMonth)}`;
      
      const fetchedEvents: RawIceEventData[] = [];

      for (const eventsUrl of [eventsUrl1, eventsUrl2]) {
        console.log(`   Fetching events from ${eventsUrl}`);
        
        try {
          // Try with enhanced headers that mimic the browser request
          const response = await fetch(eventsUrl, {
            method: 'GET',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
              'Accept': 'application/json, text/javascript, */*; q=0.01',
              'Accept-Language': 'en-US,en;q=0.9',
              'Accept-Encoding': 'gzip, deflate, br',
              'Referer': `${this.baseUrl}/Sessions`,
              'X-Requested-With': 'XMLHttpRequest',
              'Connection': 'keep-alive',
              'Sec-Fetch-Dest': 'empty',
              'Sec-Fetch-Mode': 'cors',
              'Sec-Fetch-Site': 'same-origin',
            }
          });
          
          if (!response.ok) {
            console.warn(`   ⚠️ HTTP ${response.status} for ${eventsUrl}`);
            continue;
          }
          
          const responseText = await response.text();
          console.log(`   📄 Response length: ${responseText.length} chars`);
          
          // Check if it's an error page
          if (responseText.includes('LocationError') || responseText.includes('<html>')) {
            console.warn(`   ⚠️ Got HTML error page instead of JSON from ${eventsUrl}`);
            console.log(`   First 200 chars: ${responseText.substring(0, 200)}`);
            continue;
          }
          
          // Validate JSON
          if (!(responseText.trim().startsWith('[') || responseText.trim().startsWith('{'))) {
            console.warn(`   ⚠️ Response doesn't look like JSON from ${eventsUrl}`);
            console.log(`   Response start: ${responseText.substring(0, 100)}`);
            continue;
          }

          let rawEvents: BigBearEvent[];
          try {
            rawEvents = JSON.parse(responseText);
          } catch (parseError) {
            console.error(`   ❌ JSON parse error for ${eventsUrl}: ${parseError.message}`);
            continue;
          }
          
          if (!Array.isArray(rawEvents)) {
            console.warn(`   ⚠️ Expected array but got ${typeof rawEvents} from ${eventsUrl}`);
            continue;
          }
          
          console.log(`   ✅ Parsed ${rawEvents.length} events from ${eventsUrl}`);
          
          rawEvents.forEach((event, index) => {
            try {
              const startTime = new Date(event.start);
              const endTime = new Date(event.end);

              if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
                console.warn(`   ⚠️ Invalid date for Big Bear event:`, event.start, event.end, event);
                return;
              }
              
              const eventId = event.parentEventId 
                ? `${this.rinkId}-${event.parentEventId}-${event.id}` 
                : `${this.rinkId}-${event.id || index}-${startTime.getTime()}`;

              fetchedEvents.push({
                id: eventId,
                rinkId: this.rinkId,
                title: this.cleanTitle(event.title),
                startTime,
                endTime,
                description: event.description ? event.description.trim() : undefined,
                category: this.categorizeBigBearEvent(event),
                isFeatured: false, 
                eventUrl: event.url ? `${this.baseUrl}${event.url}` : undefined,
              });
            } catch(e) {
              console.warn(`   ⚠️ Error processing individual Big Bear event item: `, event, e);
            }
          });
        } catch (e) {
          console.error(`   ❌ Error fetching/parsing from ${eventsUrl}: ${e.message}`);
        }
      }

      console.log(`🐻 Big Bear: Total events found: ${fetchedEvents.length}`);
      
      // If we got no events, let's provide some diagnostic info
      if (fetchedEvents.length === 0) {
        console.log(`   🔍 No events found. This could mean:`);
        console.log(`     - The API requires authentication/session`);
        console.log(`     - Different date format needed`);
        console.log(`     - Events are loaded differently`);
        console.log(`     - Server is blocking automated requests`);
      }
      
      fetchedEvents.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      return fetchedEvents;

    } catch (error) {
      console.error('❌ Big Bear Ice Arena scraping failed overall:', error);
      return []; 
    }
  }
}

