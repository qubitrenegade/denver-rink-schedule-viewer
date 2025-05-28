import { RawIceEventData, EventCategory } from '../../src/types.js';
import { BaseScraper } from './base-scraper.js';
import puppeteer from 'puppeteer';

interface BigBearEvent {
  id: string;
  parentEventId?: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  className: string[];
  description?: string;
  spotsLeft?: number;
  maxClassSize?: number;
  viewOnly?: boolean;
  clientFullName?: string;
  clientIds?: string;
  videoUrl?: string;
  url?: string;
}

export class BigBearScraper extends BaseScraper {
  get rinkId(): string { return 'big-bear'; }
  get rinkName(): string { return 'Big Bear Ice Arena'; }

  private readonly baseUrl = 'https://bigbearicearena.ezfacility.com';

  protected categorizeBigBearEvent(event: any): EventCategory {
    const classNames = event.className ? event.className.join(' ').toLowerCase() : '';
    const titleLower = event.title.toLowerCase();
    const backgroundColor = event.backgroundColor || '';

    // Use color coding and title analysis
    if (backgroundColor === '#9900FF' || backgroundColor === '#9900ff' || titleLower.includes('public skate')) return 'Public Skate';
    if (backgroundColor === '#FF66FF' || backgroundColor === '#ff66ff' || titleLower.includes('freestyle') || titleLower.includes('free style')) return 'Figure Skating';
    if (backgroundColor === '#00CC00' || backgroundColor === '#00cc00' || (titleLower.includes('stick') && titleLower.includes('puck'))) return 'Stick & Puck';
    if (backgroundColor === '#FF0000' || backgroundColor === '#ff0000' || backgroundColor === '#990000' || titleLower.includes('drop-in') || titleLower.includes('drop in')) return 'Drop-In Hockey';
    if (backgroundColor === '#000080' || titleLower.includes('party room')) return 'Special Event';
    if (backgroundColor === '#FFD700' || titleLower.includes('hockey party')) return 'Special Event';
    
    // Fallback to general title categorization
    return this.categorizeEvent(event.title);
  }

  async scrape(): Promise<RawIceEventData[]> {
    try {
      console.log('🐻 Scraping Big Bear Ice Arena with Puppeteer...');
      
      const fetchedEvents: RawIceEventData[] = [];
      
      console.log('🚀 Launching headless browser...');
      const browser = await puppeteer.launch({
        headless: "new",
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
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1280, height: 720 });
        
        const mainPageUrl = `${this.baseUrl}/Sessions`;
        console.log(`📄 Navigating to: ${mainPageUrl}`);
        
        await page.goto(mainPageUrl, { 
          waitUntil: 'networkidle2', 
          timeout: 30000 
        });
        
        console.log('⏳ Waiting for calendar to load...');
        await page.waitForSelector('#calendar', { timeout: 10000 });
        await page.waitForTimeout(5000); // Give more time for events to load
        
        console.log('🔍 Extracting events from FullCalendar...');
        
        // Extract events with improved parsing
        const events = await page.evaluate(() => {
          const events: any[] = [];
          
          // Debug: Check what FullCalendar data is available
          let calendarEvents: any[] = [];
          
          // Try to get events from FullCalendar API if available
          if (window && (window as any).$) {
            try {
              const $calendar = (window as any).$('#calendar');
              if ($calendar.length > 0 && $calendar.fullCalendar) {
                calendarEvents = $calendar.fullCalendar('clientEvents');
                console.log(`Found ${calendarEvents.length} events via FullCalendar API`);
              }
            } catch (e) {
              console.log('FullCalendar API not available, using DOM extraction');
            }
          }
          
          // If we got events from the API, use those
          if (calendarEvents.length > 0) {
            calendarEvents.forEach((event: any, index: number) => {
              try {
                // Parse the event data
                const title = event.title || 'Unknown Event';
                const start = event.start ? new Date(event.start) : new Date();
                const end = event.end ? new Date(event.end) : new Date(start.getTime() + 60 * 60 * 1000);
                
                events.push({
                  id: event.id || `api-${index}`,
                  title: title,
                  start: start.toISOString(),
                  end: end.toISOString(),
                  backgroundColor: event.backgroundColor || event.color || '',
                  description: event.description || '',
                  source: 'fullcalendar-api'
                });
              } catch (e) {
                console.warn(`Error processing API event ${index}:`, e);
              }
            });
          } else {
            // Fallback to DOM extraction with improved logic
            console.log('Using DOM extraction method');
            
            // Look for event elements in various possible structures
            const eventSelectors = [
              'a.fc-day-grid-event',
              '.fc-event',
              '.fc-list-item',
              '[data-eventid]'
            ];
            
            let eventElements: NodeListOf<Element> | null = null;
            
            for (const selector of eventSelectors) {
              eventElements = document.querySelectorAll(selector);
              if (eventElements.length > 0) {
                console.log(`Found ${eventElements.length} events with selector: ${selector}`);
                break;
              }
            }
            
            if (eventElements && eventElements.length > 0) {
              eventElements.forEach((eventEl, index) => {
                try {
                  const element = eventEl as HTMLElement;
                  
                  // Extract event ID
                  const eventId = element.getAttribute('data-eventid') || 
                                element.getAttribute('data-id') || 
                                `dom-${index}`;
                  
                  // Extract title - try multiple approaches
                  let title = '';
                  
                  // Method 1: Direct text content
                  const titleElement = element.querySelector('.fc-title, .fc-event-title, .fc-list-item-title');
                  if (titleElement) {
                    title = titleElement.textContent?.trim() || '';
                  }
                  
                  // Method 2: If no title element, use the element's text content
                  if (!title) {
                    title = element.textContent?.trim() || '';
                  }
                  
                  // Method 3: Check for aria-label or title attributes
                  if (!title) {
                    title = element.getAttribute('aria-label') || 
                           element.getAttribute('title') || 
                           'Unknown Event';
                  }
                  
                  // Clean up the title - remove time prefixes if present
                  title = title.replace(/^\d{1,2}(:\d{2})?\s*[ap]m?\s*/i, '').trim();
                  
                  // Extract time information
                  let startTime = new Date();
                  let endTime = new Date();
                  
                  // Method 1: Look for time in data attributes
                  const startAttr = element.getAttribute('data-start') || element.getAttribute('data-time');
                  const endAttr = element.getAttribute('data-end');
                  
                  if (startAttr) {
                    startTime = new Date(startAttr);
                    endTime = endAttr ? new Date(endAttr) : new Date(startTime.getTime() + 60 * 60 * 1000);
                  } else {
                    // Method 2: Try to find date from parent elements
                    const dateCell = element.closest('[data-date]');
                    if (dateCell) {
                      const dateStr = dateCell.getAttribute('data-date');
                      if (dateStr) {
                        const baseDate = new Date(dateStr + 'T00:00:00');
                        
                        // Look for time information in the element or its content
                        let timeMatch = element.textContent?.match(/(\d{1,2}):(\d{2})\s*([ap])m?/i);
                        
                        if (timeMatch) {
                          let hours = parseInt(timeMatch[1]);
                          const minutes = parseInt(timeMatch[2]);
                          const ampm = timeMatch[3].toLowerCase();
                          
                          if (ampm === 'p' && hours !== 12) hours += 12;
                          if (ampm === 'a' && hours === 12) hours = 0;
                          
                          startTime = new Date(baseDate);
                          startTime.setHours(hours, minutes, 0, 0);
                          
                          // Default to 90 minutes for most ice activities
                          endTime = new Date(startTime.getTime() + 90 * 60 * 1000);
                        } else {
                          // If no time found, set a default time (avoid midnight)
                          startTime = new Date(baseDate);
                          startTime.setHours(12, 0, 0, 0); // Default to noon
                          endTime = new Date(startTime.getTime() + 90 * 60 * 1000);
                        }
                      }
                    }
                  }
                  
                  // Extract background color for categorization
                  const computedStyle = window.getComputedStyle(element);
                  const backgroundColor = computedStyle.backgroundColor || 
                                        element.style.backgroundColor || 
                                        '';
                  
                  // Extract additional info
                  const popoverContent = element.querySelector('[data-content]')?.getAttribute('data-content') || '';
                  
                  events.push({
                    id: eventId,
                    title: title,
                    start: startTime.toISOString(),
                    end: endTime.toISOString(),
                    backgroundColor: backgroundColor,
                    description: popoverContent || '',
                    source: 'dom-extraction'
                  });
                  
                } catch (e) {
                  console.warn(`Error processing DOM event ${index}:`, e);
                }
              });
            }
          }
          
          console.log(`Total extracted events: ${events.length}`);
          return events;
        });
        
        console.log(`🎯 Extracted ${events.length} events from page`);
        
        // Debug: Log first few events
        if (events.length > 0) {
          console.log('🔍 Sample events:');
          events.slice(0, 3).forEach((event: any, i: number) => {
            console.log(`   ${i + 1}. "${event.title}" - ${event.start} to ${event.end}`);
          });
        }
        
        // Process events
        const now = new Date();
        const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        
        events.forEach((event: any, index: number) => {
          try {
            const startTime = new Date(event.start);
            const endTime = new Date(event.end);
            
            // Validate dates and filter to reasonable time range
            if (!isNaN(startTime.getTime()) && 
                !isNaN(endTime.getTime()) && 
                startTime >= now && 
                startTime <= thirtyDaysFromNow) {
              
              const cleanTitle = this.cleanTitle(event.title || 'Ice Session');
              
              fetchedEvents.push({
                id: `${this.rinkId}-${event.id}-${startTime.getTime()}`,
                rinkId: this.rinkId,
                title: cleanTitle,
                startTime,
                endTime,
                description: event.description || undefined,
                category: this.categorizeBigBearEvent(event),
                isFeatured: false,
                eventUrl: event.url ? `${this.baseUrl}${event.url}` : undefined,
              });
            }
          } catch (e) {
            console.warn(`⚠️ Error processing event ${index}: ${e.message}`);
          }
        });
        
      } finally {
        await browser.close();
        console.log('🔒 Browser closed');
      }
      
      console.log(`🐻 Big Bear final count: ${fetchedEvents.length} valid events`);
      
      // If we still don't have events, try the HTTP fallback
      if (fetchedEvents.length === 0) {
        console.log('🔄 No events found, trying HTTP fallback...');
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
      console.log(`📡 Trying API URL: ${apiUrl}`);
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Referer': `${this.baseUrl}/Sessions`,
          'X-Requested-With': 'XMLHttpRequest',
        }
      });
      
      console.log(`📡 HTTP Response: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const responseText = await response.text();
        console.log(`📡 Response length: ${responseText.length} characters`);
        
        if (responseText.trim().startsWith('[') || responseText.trim().startsWith('{')) {
          try {
            const apiEvents = JSON.parse(responseText);
            if (Array.isArray(apiEvents) && apiEvents.length > 0) {
              console.log(`✅ HTTP fallback successful: ${apiEvents.length} events`);
              
              return apiEvents.map((event: any, index: number) => ({
                id: `${this.rinkId}-fallback-${event.id || index}`,
                rinkId: this.rinkId,
                title: this.cleanTitle(event.title || 'Ice Session'),
                startTime: new Date(event.start || event.startTime),
                endTime: new Date(event.end || event.endTime || event.start || event.startTime),
                description: event.description || undefined,
                category: this.categorizeBigBearEvent(event),
                isFeatured: false,
                eventUrl: event.url ? `${this.baseUrl}${event.url}` : undefined,
              })).filter(event => !isNaN(event.startTime.getTime()));
            }
          } catch (parseError) {
            console.error('❌ JSON parse error:', parseError);
            console.log('📄 Raw response:', responseText.substring(0, 200) + '...');
          }
        } else {
          console.log('📄 Non-JSON response:', responseText.substring(0, 200) + '...');
        }
      }
      
      console.log('❌ HTTP fallback failed');
      return [];
      
    } catch (error) {
      console.error('❌ HTTP fallback error:', error);
      return [];
    }
  }
}
