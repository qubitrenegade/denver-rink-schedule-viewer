// workers/scrapers/apex-ice.ts - Apex Ice Arena scraper with Durable Objects scheduling
import { ScraperHelpers, RawIceEventData } from '../helpers/scraper-helpers';
import { ColoradoTimezone } from '../shared/timezone-utils';

interface Env {
  RINK_DATA: KVNamespace;
  APEX_ICE_SCHEDULER: DurableObjectNamespace;
  SCRAPER_SPLAY_MINUTES: string;
}

// Calendar configurations for different event types
const APEX_CALENDARS = [
  { id: 4, name: 'Stick and Puck' },
  { id: 6, name: 'Public Skate' },
  { id: 5, name: 'Freestyle/Figure Skating' },
  { id: 7, name: 'Adult Coffee Skate' }
];

const APEX_BASE_URL = 'https://anc.apm.activecommunities.com/apexprd';
const APEX_API_URL = `${APEX_BASE_URL}/rest/onlinecalendar/multicenter/events`;
const APEX_CALENDAR_URL = `${APEX_BASE_URL}/calendars`;

class ApexIceScraper {
  private readonly facilityId = 'apex-ice';

  // Extract CSRF token and session cookies from the main calendar page
  private async getSessionData(): Promise<{ cookies: string; csrfToken: string | null }> {
    console.log(`🔐 Getting session data from Apex calendar page...`);
    
    const response = await fetch(APEX_CALENDAR_URL, {
      headers: {
        'User-Agent': ScraperHelpers.getUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(`Failed to get session data: ${response.status} ${response.statusText}`);
    }

    // Extract cookies
    const setCookieHeaders = response.headers.getSetCookie?.() || [];
    const cookies = setCookieHeaders.map(cookie => cookie.split(';')[0]).join('; ');
    
    // Get CSRF token from page content
    const html = await response.text();
    const csrfMatch = html.match(/window\.__csrfToken\s*=\s*"([^"]+)"/);
    const csrfToken = csrfMatch ? csrfMatch[1] : null;
    
    console.log(`🔐 Session established. Cookies: ${cookies.length} chars, CSRF: ${csrfToken ? 'found' : 'not found'}`);
    
    return { cookies, csrfToken };
  }

  // Fetch calendar events via the REST API
  private async fetchCalendarEvents(calendarId: number, calendarName: string, sessionData: { cookies: string; csrfToken: string | null }): Promise<RawIceEventData[]> {
    console.log(`🧊 Fetching ${calendarName} events via API (calendar ${calendarId})...`);
    
    const requestBody = {
      calendar_id: calendarId,
      center_ids: [3], // Apex Center Ice Arena ID
      display_all: 0,
      search_start_time: "",
      search_end_time: "",
      facility_ids: [],
      activity_category_ids: [],
      activity_sub_category_ids: [],
      activity_ids: [],
      activity_min_age: null,
      activity_max_age: null,
      event_type_ids: []
    };

    const headers: Record<string, string> = {
      'User-Agent': ScraperHelpers.getUserAgent(),
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.5',
      'Content-Type': 'application/json;charset=utf-8',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': `${APEX_CALENDAR_URL}?defaultCalendarId=${calendarId}`,
      'Origin': APEX_BASE_URL,
    };

    if (sessionData.cookies) {
      headers['Cookie'] = sessionData.cookies;
    }

    if (sessionData.csrfToken) {
      headers['X-CSRF-Token'] = sessionData.csrfToken;
    }

    const response = await fetch(`${APEX_API_URL}?locale=en-US`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`📊 API response received for ${calendarName}`);
    
    return this.parseApiResponse(data, calendarName);
  }

  // Parse the API response from the REST endpoint
  private parseApiResponse(data: any, calendarType: string): RawIceEventData[] {
    const events: RawIceEventData[] = [];
    
    try {
      if (data.body && data.body.center_events && Array.isArray(data.body.center_events)) {
        for (const centerData of data.body.center_events) {
          if (centerData.events && Array.isArray(centerData.events)) {
            for (const event of centerData.events) {
              const processed = this.processApiEvent(event, calendarType);
              if (processed) {
                events.push(processed);
              }
            }
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️ Error parsing API response for ${calendarType}:`, error);
    }

    console.log(`📅 Parsed ${events.length} events from ${calendarType} API response`);
    return events;
  }

  // Process individual event from the API response
  private processApiEvent(event: any, calendarType: string): RawIceEventData | null {
    try {
      if (!event.title || !event.start_time || !event.end_time) {
        return null;
      }

      // Determine rink (East vs West) from facility info
      let rinkId = 'apex-ice-east'; // Default to East
      let rinkName = 'East Rink';
      
      if (event.facilities && event.facilities.length > 0) {
        const facility = event.facilities[0];
        if (facility.facility_name && facility.facility_name.includes('West')) {
          rinkId = 'apex-ice-west';
          rinkName = 'West Rink';
        } else if (facility.facility_name && facility.facility_name.includes('East')) {
          rinkId = 'apex-ice-east';
          rinkName = 'East Rink';
        }
      }

      // Parse datetime (API returns in format "2025-06-10 11:00:00")
      // Use the timezone-aware parser instead of assuming local time
      const startUtc = ColoradoTimezone.parseMountainTime(event.start_time);
      const endUtc = ColoradoTimezone.parseMountainTime(event.end_time);

      const eventId = `${rinkId}-${event.event_item_id || Date.now()}`;

      return {
        id: eventId,
        rinkId,
        title: ScraperHelpers.cleanTitle(event.title),
        startTime: startUtc.toISOString(),
        endTime: endUtc.toISOString(),
        description: event.description || `${calendarType} at ${rinkName}`,
        category: ScraperHelpers.categorizeEvent(event.title + ' ' + calendarType),
        eventUrl: `${APEX_BASE_URL}/ActiveNet_Calendar`
      };
    } catch (error) {
      console.warn(`⚠️ Failed to process API event:`, error);
      return null;
    }
  }

  private parseHtmlCalendarData(html: string, calendarType: string): RawIceEventData[] {
    const events: RawIceEventData[] = [];
    
    console.log(`🔍 DEBUG: Looking for HTML calendar events...`);
    
    // Look for ActiveCommunities calendar patterns
    const patterns = [
      // Calendar event containers
      /<div[^>]*class="[^"]*calendar[^"]*event[^"]*"[^>]*>(.*?)<\/div>/gis,
      /<div[^>]*class="[^"]*event[^"]*"[^>]*>(.*?)<\/div>/gis,
      // Table rows with event data
      /<tr[^>]*class="[^"]*event[^"]*"[^>]*>(.*?)<\/tr>/gis,
      /<tr[^>]*data-event[^>]*>(.*?)<\/tr>/gis,
      // Activity/session rows
      /<tr[^>]*class="[^"]*activity[^"]*"[^>]*>(.*?)<\/tr>/gis,
      /<tr[^>]*class="[^"]*session[^"]*"[^>]*>(.*?)<\/tr>/gis,
      // List items with calendar data
      /<li[^>]*class="[^"]*calendar[^"]*"[^>]*>(.*?)<\/li>/gis,
      // Specific ActiveCommunities patterns
      /<td[^>]*class="[^"]*cal[^"]*day[^"]*"[^>]*>(.*?)<\/td>/gis
    ];

    for (const pattern of patterns) {
      let match;
      let count = 0;
      while ((match = pattern.exec(html)) !== null && count < 100) { // Limit to prevent infinite loops
        const eventHtml = match[1];
        if (eventHtml && eventHtml.trim().length > 10) { // Only process substantial content
          const processed = this.processHtmlEvent(eventHtml, calendarType);
          if (processed) {
            events.push(processed);
          }
        }
        count++;
      }
    }

    console.log(`🔍 DEBUG: Found ${events.length} events from HTML parsing`);
    return events;
  }

  private parseScriptCalendarData(html: string, calendarType: string): RawIceEventData[] {
    const events: RawIceEventData[] = [];
    
    // Look for JSON data in script tags
    const scriptPattern = /<script[^>]*>(.*?)<\/script>/gis;
    let match;
    
    while ((match = scriptPattern.exec(html)) !== null) {
      const scriptContent = match[1];
      
      // Look for calendar event data patterns
      const jsonPatterns = [
        /events\s*[=:]\s*(\[.*?\])/s,
        /calendar\s*[=:]\s*({.*?})/s,
        /"events"\s*:\s*(\[.*?\])/s
      ];

      for (const jsonPattern of jsonPatterns) {
        const jsonMatch = scriptContent.match(jsonPattern);
        if (jsonMatch) {
          try {
            const data = JSON.parse(jsonMatch[1]);
            if (Array.isArray(data)) {
              data.forEach(event => {
                const processed = this.processCalendarEvent(event, calendarType);
                if (processed) {
                  events.push(processed);
                }
              });
            }
          } catch (error) {
            console.warn(`⚠️ Failed to parse JSON in script:`, error);
          }
        }
      }
    }

    return events;
  }

  private processCalendarEvent(eventData: any, calendarType: string): RawIceEventData | null {
    try {
      // Extract basic event information
      const title = eventData.title || eventData.name || eventData.summary || calendarType;
      const startTime = eventData.start || eventData.startTime || eventData.start_time;
      const endTime = eventData.end || eventData.endTime || eventData.end_time;
      const description = eventData.description || eventData.details || '';
      const location = eventData.location || eventData.venue || '';

      // Determine which rink (East vs West)
      let rinkId = 'apex-ice-east'; // Default to East
      const locationLower = (title + ' ' + description + ' ' + location).toLowerCase();
      
      if (locationLower.includes('west') || locationLower.includes('rink 2')) {
        rinkId = 'apex-ice-west';
      } else if (locationLower.includes('east') || locationLower.includes('rink 1')) {
        rinkId = 'apex-ice-east';
      }

      // Parse dates - try multiple formats
      let startDate: Date;
      let endDate: Date;

      if (startTime && endTime) {
        startDate = new Date(startTime);
        endDate = new Date(endTime);
      } else {
        // Fallback to current date if no specific date found
        const now = new Date();
        startDate = new Date(now);
        endDate = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hour default
      }

      // Convert from Mountain Time to UTC if needed
      if (startDate.getTimezoneOffset() === 0) {
        startDate.setTime(startDate.getTime() + (6 * 60 * 60 * 1000));
        endDate.setTime(endDate.getTime() + (6 * 60 * 60 * 1000));
      }

      // Generate unique ID
      const eventId = `${rinkId}-${startDate.getTime()}-${title.replace(/\s+/g, '-').toLowerCase()}`;

      return {
        id: eventId,
        rinkId,
        title: ScraperHelpers.cleanTitle(title),
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        description: description.substring(0, 500), // Limit description length
        category: ScraperHelpers.categorizeEvent(title + ' ' + calendarType),
        eventUrl: `https://anc.apm.activecommunities.com/apexprd/calendars`
      };
    } catch (error) {
      console.warn(`⚠️ Failed to process event:`, error);
      return null;
    }
  }

  private processHtmlEvent(eventHtml: string, calendarType: string): RawIceEventData | null {
    // Extract event data from HTML content
    // This is a fallback method when structured data isn't available
    const titleMatch = eventHtml.match(/>([^<]+)</);
    const title = titleMatch ? titleMatch[1].trim() : calendarType;

    // For now, create a basic event
    // In a real implementation, you'd parse the HTML more thoroughly
    const now = new Date();
    const startDate = new Date(now);
    const endDate = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    return {
      id: `apex-ice-east-${Date.now()}-${Math.random()}`,
      rinkId: 'apex-ice-east',
      title: ScraperHelpers.cleanTitle(title),
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
      description: `${calendarType} event from HTML parsing`,
      category: ScraperHelpers.categorizeEvent(title + ' ' + calendarType),
      eventUrl: `https://anc.apm.activecommunities.com/apexprd/calendars`
    };
  }

  async scrape(): Promise<RawIceEventData[]> {
    console.log(`🧊 Starting Apex Ice Arena scraping via API...`);

    try {
      // First, get session data (cookies and CSRF token)
      const sessionData = await this.getSessionData();
      
      const allEvents: RawIceEventData[] = [];

      // Fetch events for each calendar type
      for (const calendar of APEX_CALENDARS) {
        try {
          const events = await this.fetchCalendarEvents(calendar.id, calendar.name, sessionData);
          allEvents.push(...events);
          
          // Small delay between requests to be respectful
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`❌ Failed to fetch ${calendar.name} events:`, error);
          // Continue with other calendars even if one fails
        }
      }

      console.log(`📊 Total events scraped from Apex Ice Arena: ${allEvents.length}`);

      // Filter to next 30 days and sort
      const filtered = ScraperHelpers.filterEventsToNext30Days(allEvents);
      const sorted = ScraperHelpers.sortEventsByTime(filtered);

      console.log(`📅 Filtered to ${sorted.length} events in next 30 days`);
      return sorted;
      
    } catch (error) {
      console.error(`❌ Critical error in Apex Ice Arena scraping:`, error);
      return [];
    }
  }
}

// Durable Object for handling scheduling
export class ApexIceScheduler {
  private state: DurableObjectState;
  private env: Env;
  private scraper: ApexIceScraper;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.scraper = new ApexIceScraper();
  }

  async fetch(request: Request): Promise<Response> {
    return ScraperHelpers.handleSchedulerFetch(
      request,
      this.state,
      this.env,
      'apex-ice',
      () => this.runScraper()
    );
  }

  async alarm(): Promise<void> {
    return ScraperHelpers.handleSchedulerAlarm(
      this.state,
      this.env,
      'apex-ice',
      () => this.runScraper()
    );
  }

  private async runScraper(): Promise<Response> {
    const startTime = Date.now();
    console.log(`🕐 Apex Ice scraper started at ${new Date().toISOString()}`);

    try {
      const events = await this.scraper.scrape();

      // Use aggregated approach since we have East and West rinks
      const aggregatedConfig = {
        facilityName: 'Apex Ice Arena',
        displayName: 'Apex Ice Arena (Arvada)',
        sourceUrl: 'https://anc.apm.activecommunities.com/apexprd/calendars',
        rinkName: 'Apex Ice Arena',
        aggregatedRinks: [
          { rinkId: 'apex-ice-east', rinkName: 'East Rink' },
          { rinkId: 'apex-ice-west', rinkName: 'West Rink' }
        ]
      };

      await ScraperHelpers.writeToKV(this.env.RINK_DATA, 'apex-ice', events, aggregatedConfig);

      // Update last run time
      await this.state.storage.put('lastRun', new Date().toISOString());

      const duration = Date.now() - startTime;
      console.log(`✅ Apex Ice scraping completed in ${duration}ms`);

      return ScraperHelpers.jsonResponse({
        success: true,
        eventCount: events.length,
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`,
        message: `Successfully scraped ${events.length} events from Apex Ice Arena`
      });

    } catch (error) {
      console.error('❌ Apex Ice scraping failed:', error);

      await ScraperHelpers.writeErrorMetadata(this.env.RINK_DATA, 'apex-ice', error, {
        facilityName: 'Apex Ice Arena',
        displayName: 'Apex Ice Arena (Arvada)',
        sourceUrl: 'https://anc.apm.activecommunities.com/apexprd/calendars',
        rinkName: 'Apex Ice Arena'
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
    const id = env.APEX_ICE_SCHEDULER.idFromName('apex-ice');
    const stub = env.APEX_ICE_SCHEDULER.get(id);

    return stub.fetch(request);
  }
  
  // Cron scheduling removed - now managed by centralized scheduler
};