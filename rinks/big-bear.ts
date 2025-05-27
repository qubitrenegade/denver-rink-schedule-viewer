
import { RawIceEventData, EventCategory } from '../types';
import { BaseScraper } from './base-scraper';

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
        console.log(`   Fetching from ${eventsUrl}`);
        let responseJsonString: string | null = null;

        for (const proxyUrl of this.proxyUrls) {
            try {
                const fetchFullUrl = `${proxyUrl}${encodeURIComponent(eventsUrl)}`;
                console.log(`   Trying proxy: ${fetchFullUrl}`);
                const response = await fetch(fetchFullUrl);
                if (!response.ok) {
                    const errorText = await response.text().catch(() => 'Failed to get error text from response');
                    throw new Error(`HTTP ${response.status}: ${errorText.substring(0,150)}`);
                }

                if (proxyUrl.includes('allorigins.win')) {
                    const data = await response.json(); // allorigins wraps the response
                    if (data && data.contents) {
                        responseJsonString = data.contents;
                        console.log(`   ✅ Success with allorigins: ${responseJsonString.length} chars`);
                        break; 
                    } else {
                        const errorDetail = data && data.status ? `Status: ${JSON.stringify(data.status)}` : 'No contents field in allorigins response';
                        throw new Error(errorDetail);
                    }
                } else { 
                    responseJsonString = await response.text();
                    if (responseJsonString && responseJsonString.trim().startsWith('[') && responseJsonString.trim().endsWith(']')) {
                        console.log(`   ✅ Success with direct proxy: ${responseJsonString.length} chars`);
                        break;
                    } else {
                        throw new Error(`Direct proxy did not return valid JSON. Starts with: ${responseJsonString.substring(0,100)}`);
                    }
                }
            } catch (e) {
                console.warn(`   ⚠️ Proxy ${proxyUrl} failed for ${eventsUrl}: ${e.message}`);
                responseJsonString = null; 
            }
        }

        if (!responseJsonString) {
            console.error(`   ❌ Failed to fetch from ${eventsUrl} using all available proxies.`);
            continue; 
        }
        
        // Validate if it's JSON before parsing
        if (!(responseJsonString.trim().startsWith('[') && responseJsonString.trim().endsWith(']'))) {
            console.error(`   ❌ Content from ${eventsUrl} is not valid JSON. Snippet: ${responseJsonString.substring(0, 200)}`);
            continue; // Skip to the next month's URL
        }

        try {
            const rawEvents: BigBearEvent[] = JSON.parse(responseJsonString);
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
            console.error(`   ❌ Error parsing final JSON from ${eventsUrl}: ${e.message}. Content snippet: ${responseJsonString.substring(0, 500)}`);
        }
      }

      console.log(`🐻 Big Bear: Processed fetches. Total events found: ${fetchedEvents.length}`);
      fetchedEvents.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      return fetchedEvents;

    } catch (error) {
      console.error('❌ Big Bear Ice Arena scraping failed overall:', error);
      // Avoid trying to access responseText if it's not a custom error from fetchWithFallback
      if (error && typeof (error as any).responseText === 'string') { 
        console.error('Failed JSON content (from error object):', (error as any).responseText.substring(0, 500));
      }
      return []; 
    }
  }
}
