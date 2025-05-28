import { RawIceEventData, EventCategory } from '../../src/types.js';
import { BaseScraper } from './base-scraper.js';
import puppeteer from 'puppeteer';

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

  protected categorizeBigBearEvent(event: any): EventCategory {
    const classNames = event.className ? event.className.join(' ').toLowerCase() : '';
    const titleLower = event.title.toLowerCase();
    const backgroundColor = event.backgroundColor || '';

    // Use color coding as primary categorization method (from the HTML analysis)
    if (backgroundColor === '#9900FF' || backgroundColor === '#9900ff' || titleLower.includes('public skate')) return 'Public Skate';
    if (backgroundColor === '#FF66FF' || backgroundColor === '#ff66ff' || titleLower.includes('freestyle') || titleLower.includes('free style')) return 'Figure Skating';
    if (backgroundColor === '#00CC00' || backgroundColor === '#00cc00' || (titleLower.includes('stick') && titleLower.includes('puck'))) return 'Stick & Puck';
    if (backgroundColor === '#FF0000' || backgroundColor === '#ff0000' || backgroundColor === '#990000' || backgroundColor === '#990000' || titleLower.includes('drop-in') || titleLower.includes('drop in')) return 'Drop-In Hockey';
    if (backgroundColor === '#000080' || titleLower.includes('party room')) return 'Special Event'; // Navy - Party Room
    if (backgroundColor === '#FFD700' || titleLower.includes('hockey party')) return 'Special Event'; // Gold - Hockey Party Room
    
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
        
        console.log('🔍 Extracting events from FullCalendar...');
        
        // Extract events with proper parsing
        const events = await page.evaluate(() => {
          const events: any[] = [];
          
          // Find all event elements - specifically target the anchor tags with event data
          const eventElements = document.querySelectorAll('a.fc-day-grid-event[data-eventid]');
          
          eventElements.forEach((eventEl, index) => {
            try {
              const anchor = eventEl as HTMLAnchorElement;
              
              // Extract basic info
              const eventId = anchor.getAttribute('data-eventid') || `extracted-${index}`;
              const title = anchor.textContent?.trim() || 'Unknown Event';
              
              // Extract style information for categorization
              const style = anchor.getAttribute('style') || '';
              const backgroundColorMatch = style.match(/background-color:\s*([^;]+)/i);
              const backgroundColor = backgroundColorMatch ? backgroundColorMatch[1] : '';
              
              // Find the parent cell with the date
              const parentCell = anchor.closest('td[data-date], th[data-date]');
              let eventDate = new Date(); // Default to today
              
              if (parentCell) {
                const dateStr = parentCell.getAttribute('data-date');
                if (dateStr) {
                  eventDate = new Date(dateStr);
                }
              } else {
                // Try to find date from the calendar structure
                const weekRow = anchor.closest('.fc-week');
                if (weekRow) {
                  const allCells = weekRow.querySelectorAll('.fc-day[data-date]');
                  const eventContainer = anchor.closest('.fc-event-container');
                  if (eventContainer) {
                    const containerIndex = Array.from(eventContainer.parentElement?.children || []).indexOf(eventContainer);
                    if (containerIndex >= 0 && containerIndex < allCells.length) {
                      const cellDate = allCells[containerIndex].getAttribute('data-date');
                      if (cellDate) {
                        eventDate = new Date(cellDate);
                      }
                    }
                  }
                }
              }
              
              // Parse time from title text
              let startTime = new Date(eventDate);
              let endTime = new Date(eventDate);
              
              // Extract time from the title (e.g., "3:45p Open Stick & Puck", "6a Free Style")
              const timeMatch = title.match(/^(\d{1,2}(?::\d{2})?)\s*([ap])/i);
              if (timeMatch) {
                const timeStr = timeMatch[1];
                const ampm = timeMatch[2].toLowerCase();
                
                let hours = 0;
                let minutes = 0;
                
                if (timeStr.includes(':')) {
                  const [h, m] = timeStr.split(':');
                  hours = parseInt(h);
                  minutes = parseInt(m);
                } else {
                  hours = parseInt(timeStr);
                }
                
                // Convert to 24-hour format
                if (ampm === 'p' && hours !== 12) {
                  hours += 12;
                } else if (ampm === 'a' && hours === 12) {
                  hours = 0;
                }
                
                startTime.setHours(hours, minutes, 0, 0);
                
                // Try to extract duration from popover data
                const popoverContent = anchor.querySelector('[data-content]')?.getAttribute('data-content') || '';
                let durationMinutes = 60; // Default 1 hour
                
                const durationMatch = popoverContent.match(/(\d+)\s*hour\(s\)(?:\s*(\d+)\s*minutes?)?/i);
                if (durationMatch) {
                  const hours = parseInt(durationMatch[1]) || 0;
                  const mins = parseInt(durationMatch[2]) || 0;
                  durationMinutes = (hours * 60) + mins;
                }
                
                endTime = new Date(startTime.getTime() + (durationMinutes * 60 * 1000));
              } else {
                // If we can't parse time, set a default 1-hour duration
                endTime = new Date(startTime.getTime() + (60 * 60 * 1000));
              }
              
              // Clean the title to remove time prefix
              const cleanTitle = title.replace(/^\d{1,2}(?::\d{2})?\s*[ap]\s*/i, '').trim();
              
              // Extract additional info from popover
              const popoverEl = anchor.querySelector('[data-content]');
              let description = '';
              let spotsLeft = 0;
              
              if (popoverEl) {
                const popoverContent = popoverEl.getAttribute('data-content') || '';
                
                // Extract spots left
                const spotsMatch = popoverContent.match(/(\d+)\s*Spot\(s\)\s*Left/i);
                if (spotsMatch) {
                  spotsLeft = parseInt(spotsMatch[1]);
                }
                
                // Extract venue info
                const venueMatch = popoverContent.match(/Venues\s*-\s*([^<]+)/i);
                if (venueMatch) {
                  description = `Venue: ${venueMatch[1].trim()}`;
                }
                
                if (spotsLeft > 0) {
                  description += description ? ` • ${spotsLeft} spots left` : `${spotsLeft} spots left`;
                }
              }
              
              events.push({
                id: eventId,
                title: cleanTitle,
                start: startTime.toISOString(),
                end: endTime.toISOString(),
                backgroundColor: backgroundColor,
                description: description || undefined,
                spotsLeft: spotsLeft,
                source: 'fullcalendar-extraction'
              });
              
            } catch (e) {
              console.warn(`Error processing event ${index}:`, e);
            }
          });
          
          return events;
        });
        
        console.log(`🎯 Extracted ${events.length} events from FullCalendar`);
        
        // Process the extracted events
        events.forEach((event: any, index: number) => {
          try {
            const startTime = new Date(event.start);
            const endTime = new Date(event.end);
            
            if (!isNaN(startTime.getTime()) && !isNaN(endTime.getTime())) {
              fetchedEvents.push({
                id: event.id || `big-bear-${index}-${startTime.getTime()}`,
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
            console.warn(`⚠️ Error processing extracted event ${index}: ${e.message}`);
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
