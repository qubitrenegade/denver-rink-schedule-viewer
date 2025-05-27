import { RawIceEventData, EventCategory } from '../../src/types.js';
import { BaseScraper } from './base-scraper.js';
import puppeteer from 'puppeteer';
import { writeFile } from 'fs/promises';

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

  protected categorizeBigBearEvent(event: BigBearEvent | any): EventCategory {
    const classNames = event.className ? event.className.join(' ').toLowerCase() : '';
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
      console.log('🐻 Scraping Big Bear Ice Arena with Puppeteer...');
      
      const fetchedEvents: RawIceEventData[] = [];
      
      // Launch Puppeteer browser
      console.log('🚀 Launching headless browser...');
      const browser = await puppeteer.launch({
        headless: "new", // Use new headless mode
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ]
      });
      
      try {
        const page = await browser.newPage();
        
        // Set user agent and viewport
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1280, height: 720 });
        
        const mainPageUrl = `${this.baseUrl}/Sessions`;
        console.log(`📄 Navigating to: ${mainPageUrl}`);
        
        // Navigate and wait for the page to load
        await page.goto(mainPageUrl, { 
          waitUntil: 'networkidle2', 
          timeout: 30000 
        });
        
        console.log('⏳ Waiting for calendar to load...');
        
        // Wait for FullCalendar to initialize
        await page.waitForSelector('#calendar', { timeout: 10000 });
        
        // Give extra time for events to load
        await page.waitForTimeout(3000);
        
        // Add some debugging info about what's on the page
        const pageInfo = await page.evaluate(() => {
          return {
            title: document.title,
            url: window.location.href,
            hasJQuery: typeof (window as any).$ !== 'undefined',
            hasFullCalendar: typeof (window as any).$ !== 'undefined' && typeof (window as any).$.fn.fullCalendar !== 'undefined',
            calendarExists: !!document.getElementById('calendar'),
            scriptCount: document.querySelectorAll('script').length,
            eventElementCount: document.querySelectorAll('.fc-event, .fc-daygrid-event, .fc-timegrid-event').length
          };
        });
        
        console.log('📊 Page info:', pageInfo);
        
        console.log('🔍 Extracting events from loaded calendar...');
        
        // Let's dump everything we can about the page
        const pageData = await page.evaluate(() => {
          const eventElements = document.querySelectorAll('.fc-event, .fc-daygrid-event, .fc-timegrid-event, [class*="fc-event"]');
          
          return {
            // Sample of event element HTML
            sampleEvents: Array.from(eventElements).slice(0, 10).map((el, index) => ({
              index,
              outerHTML: el.outerHTML,
              textContent: el.textContent?.trim(),
              className: el.className,
              attributes: Array.from(el.attributes).reduce((acc, attr) => {
                acc[attr.name] = attr.value;
                return acc;
              }, {} as any),
              children: Array.from(el.children).map(child => ({
                tagName: child.tagName,
                className: child.className,
                textContent: child.textContent?.trim()
              }))
            })),
            
            // Check for FullCalendar instance
            hasFullCalendar: typeof (window as any).$ !== 'undefined' && typeof (window as any).$.fn.fullCalendar !== 'undefined',
            
            // Try to get FullCalendar version
            fullCalendarVersion: (window as any).$ && (window as any).$.fn.fullCalendar ? 
              (window as any).$.fn.fullCalendar.version || 'unknown' : 'not available',
            
            // Global variables that might contain events
            globalVars: {
              calendarEvents: typeof (window as any).calendarEvents,
              events: typeof (window as any).events,
              scheduleData: typeof (window as any).scheduleData,
              fullCalendarEvents: typeof (window as any).fullCalendarEvents
            },
            
            // Calendar element info
            calendarElement: (() => {
              const cal = document.getElementById('calendar');
              if (cal) {
                return {
                  innerHTML: cal.innerHTML.substring(0, 1000) + '...',
                  className: cal.className,
                  children: Array.from(cal.children).map(child => child.tagName)
                };
              }
              return null;
            })()
          };
        });
        
        console.log('📄 PAGE DATA DUMP:');
        console.log('==================');
        console.log(`Found ${pageData.sampleEvents.length} sample events to examine:`);
        
        pageData.sampleEvents.forEach((event, index) => {
          console.log(`\nEvent ${index}:`);
          console.log(`  HTML: ${event.outerHTML.substring(0, 200)}...`);
          console.log(`  Text: "${event.textContent}"`);
          console.log(`  Class: "${event.className}"`);
          console.log(`  Attributes:`, event.attributes);
          console.log(`  Children:`, event.children);
        });
        
        console.log(`\nFullCalendar Info:`);
        console.log(`  Available: ${pageData.hasFullCalendar}`);
        console.log(`  Version: ${pageData.fullCalendarVersion}`);
        
        console.log(`\nGlobal Variables:`);
        console.log(`  calendarEvents: ${pageData.globalVars.calendarEvents}`);
        console.log(`  events: ${pageData.globalVars.events}`);
        console.log(`  scheduleData: ${pageData.globalVars.scheduleData}`);
        
        console.log(`\nCalendar Element:`, pageData.calendarElement);
        
        // Also save the full page HTML to a file for inspection
        const fullHTML = await page.content();
        console.log(`\n💾 Full page HTML length: ${fullHTML.length} characters`);
        
        // Save to file in the current directory so you can examine it
        await writeFile('./debug-bigbear-page.html', fullHTML, 'utf-8');
        console.log('💾 Saved full page HTML to: ./debug-bigbear-page.html');
        
        // Extract events using the info we just gathered
        const events = await page.evaluate(() => {
          const events: any[] = [];
          
          // Based on what we see, try to extract events
          const eventElements = document.querySelectorAll('.fc-event, .fc-daygrid-event, .fc-timegrid-event, [class*="fc-event"]');
          
          eventElements.forEach((el, index) => {
            const title = el.textContent?.trim() || '';
            if (title && title.length > 2) {
              // Try to find parent cell with date
              let dateStr = '';
              const parentCell = el.closest('[data-date]');
              if (parentCell) {
                dateStr = parentCell.getAttribute('data-date') || '';
              }
              
              events.push({
                id: `extracted-${index}`,
                title: title,
                start: dateStr || new Date().toISOString().split('T')[0],
                end: dateStr || new Date().toISOString().split('T')[0],
                source: 'dom-extraction'
              });
            }
          });
          
          return events;
        });
        
        console.log(`🎯 Extracted ${(events || []).length} raw events from browser`);
        
        // Process the extracted events
        (events || []).forEach((event: any, index: number) => {
          try {
            let startTime: Date;
            let endTime: Date;
            
            // Handle different date formats
            if (event.start) {
              startTime = new Date(event.start);
            } else if (event.time) {
              // Try to parse time from string
              const today = new Date();
              startTime = new Date(today.toDateString() + ' ' + event.time);
            } else {
              console.warn(`⚠️ No start time for event: ${event.title}`);
              return;
            }
            
            if (event.end) {
              endTime = new Date(event.end);
            } else {
              // Default to 1 hour duration
              endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
            }
            
            if (!isNaN(startTime.getTime())) {
              const eventId = event.id || `big-bear-${index}-${startTime.getTime()}`;
              
              fetchedEvents.push({
                id: eventId,
                rinkId: this.rinkId,
                title: this.cleanTitle(event.title || 'Unknown Event'),
                startTime,
                endTime,
                description: event.description || undefined,
                category: this.categorizeBigBearEvent(event),
                isFeatured: false,
                eventUrl: event.url ? `${this.baseUrl}${event.url}` : undefined,
              });
            }
          } catch (e) {
            console.warn(`⚠️ Error processing browser event ${index}: ${e.message}`);
          }
        });
        
      } finally {
        await browser.close();
        console.log('🔒 Browser closed');
      }
      
      console.log(`🐻 Big Bear Puppeteer: Total events found: ${fetchedEvents.length}`);
      
      // If Puppeteer didn't find events, fall back to the old HTTP method
      if (fetchedEvents.length === 0) {
        console.log('🔄 Puppeteer found no events, falling back to HTTP method...');
        return await this.httpFallback();
      }
      
      fetchedEvents.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      return fetchedEvents;

    } catch (error) {
      console.error('❌ Big Bear Puppeteer scraping failed:', error);
      console.log('🔄 Trying HTTP fallback...');
      return await this.httpFallback();
    }
  }
  
  private async httpFallback(): Promise<RawIceEventData[]> {
    console.log('📡 Attempting HTTP fallback method...');
    
    try {
      const today = new Date();
      const start = today.toISOString().split('T')[0];
      const endDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
      const end = endDate.toISOString().split('T')[0];
      
      const apiUrl = `${this.baseUrl}/Sessions/GetCalenderEvents?start=${start}&end=${end}`;
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Referer': `${this.baseUrl}/Sessions`,
          'X-Requested-With': 'XMLHttpRequest',
        }
      });
      
      if (response.ok) {
        const responseText = await response.text();
        if (responseText.trim().startsWith('[')) {
          const apiEvents = JSON.parse(responseText);
          if (Array.isArray(apiEvents) && apiEvents.length > 0) {
            console.log(`✅ HTTP fallback successful: ${apiEvents.length} events`);
            
            return apiEvents.map((event: any, index: number) => ({
              id: `${this.rinkId}-fallback-${event.id || index}`,
              rinkId: this.rinkId,
              title: this.cleanTitle(event.title),
              startTime: new Date(event.start),
              endTime: new Date(event.end || event.start),
              description: event.description || undefined,
              category: this.categorizeBigBearEvent(event),
              isFeatured: false,
              eventUrl: event.url ? `${this.baseUrl}${event.url}` : undefined,
            })).filter(event => !isNaN(event.startTime.getTime()));
          }
        }
      }
      
      console.log('❌ HTTP fallback also failed');
      return [];
      
    } catch (error) {
      console.error('❌ HTTP fallback error:', error);
      return [];
    }
  }
}
