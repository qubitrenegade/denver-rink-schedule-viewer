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

  // Helper to create Mountain Time dates
  private createMountainTime(dateStr: string, timeStr: string): Date {
    // Parse the date (YYYY-MM-DD format)
    const [year, month, day] = dateStr.split('-').map(Number);
    
    // Parse the time
    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*([ap])m?/i);
    if (!timeMatch) {
      // Fallback for times without minutes or AM/PM
      const hourMatch = timeStr.match(/(\d{1,2})\s*([ap])/i);
      if (hourMatch) {
        let hours = parseInt(hourMatch[1]);
        const ampm = hourMatch[2].toLowerCase();
        
        if (ampm === 'p' && hours !== 12) hours += 12;
        if (ampm === 'a' && hours === 12) hours = 0;
        
        // Create date in Mountain Time (UTC-7/-6 depending on DST)
        // For 2025, May 28 is during DST, so UTC-6
        const mtDate = new Date(year, month - 1, day, hours, 0, 0, 0);
        return mtDate;
      }
      // If we can't parse the time, return noon on the given date
      return new Date(year, month - 1, day, 12, 0, 0, 0);
    }
    
    let hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);
    const ampm = timeMatch[3].toLowerCase();
    
    // Convert to 24-hour format
    if (ampm === 'p' && hours !== 12) hours += 12;
    if (ampm === 'a' && hours === 12) hours = 0;
    
    // Create the date in local timezone (should be Mountain Time for the scraper)
    const mtDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
    return mtDate;
  }

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
        executablePath: '/usr/bin/google-chrome-stable', // Use system Chrome
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
        
        // Set timezone to Mountain Time to ensure proper time parsing
        await page.emulateTimezone('America/Denver');
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
        await page.waitForTimeout(5000);
        
        console.log('🔍 Extracting events from FullCalendar...');
        
        const events = await page.evaluate(() => {
          const events: any[] = [];
          
          // Debug: Check browser timezone
          const now = new Date();
          console.log(`Browser timezone offset: ${now.getTimezoneOffset()} minutes`);
          console.log(`Browser timezone name: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
          console.log(`Sample date: ${now.toString()}`);
          
          // Try to get events from FullCalendar API first
          let calendarEvents: any[] = [];
          
          if (window && (window as any).$) {
            try {
              const $calendar = (window as any).$('#calendar');
              if ($calendar.length > 0 && typeof $calendar.fullCalendar === 'function') {
                calendarEvents = $calendar.fullCalendar('clientEvents');
                console.log(`Found ${calendarEvents.length} events via FullCalendar API`);
              }
            } catch (e) {
              console.log('FullCalendar API not available, using DOM extraction');
            }
          }
          
          if (calendarEvents.length > 0) {
            // Use FullCalendar API events - these should have proper times
            calendarEvents.forEach((event: any, index: number) => {
              try {
                const title = event.title || 'Unknown Event';
                
                // FullCalendar events should already have proper Date objects
                let startTime: Date;
                let endTime: Date;
                
                // Handle different FullCalendar date formats
                if (event.start) {
                  if (typeof event.start === 'string') {
                    startTime = new Date(event.start);
                  } else if (event.start._d) {
                    // Moment.js object
                    startTime = new Date(event.start._d);
                  } else if (event.start.toDate) {
                    // Moment.js with toDate method
                    startTime = event.start.toDate();
                  } else if (event.start instanceof Date) {
                    startTime = event.start;
                  } else {
                    // Try to convert to date
                    startTime = new Date(event.start.toString());
                  }
                } else {
                  startTime = new Date();
                }
                
                if (event.end) {
                  if (typeof event.end === 'string') {
                    endTime = new Date(event.end);
                  } else if (event.end._d) {
                    endTime = new Date(event.end._d);
                  } else if (event.end.toDate) {
                    endTime = event.end.toDate();
                  } else if (event.end instanceof Date) {
                    endTime = event.end;
                  } else {
                    endTime = new Date(event.end.toString());
                  }
                } else {
                  // Default to 90 minutes if no end time
                  endTime = new Date(startTime.getTime() + 90 * 60 * 1000);
                }
                
                // If the times look like they might be UTC when they should be Mountain Time,
                // check if we need to adjust them
                const hour = startTime.getHours();
                if (hour < 6) {
                  // Times before 6 AM are suspicious for an ice rink - they might be UTC times
                  // that should be Mountain Time. Let's check if adding 6 hours makes sense.
                  const adjustedStart = new Date(startTime.getTime() + 6 * 60 * 60 * 1000);
                  const adjustedEnd = new Date(endTime.getTime() + 6 * 60 * 60 * 1000);
                  
                  if (adjustedStart.getHours() >= 6 && adjustedStart.getHours() <= 23) {
                    console.log(`Big Bear API: Adjusting suspicious time ${startTime.toISOString()} -> ${adjustedStart.toISOString()}`);
                    startTime = adjustedStart;
                    endTime = adjustedEnd;
                  }
                }
                
                // Debug the API event
                console.log(`API Event: "${title}" - Start: ${startTime.toString()}, End: ${endTime.toString()}`);
                console.log(`API Start ISO: ${startTime.toISOString()}, End ISO: ${endTime.toISOString()}`);
                
                events.push({
                  id: event.id || `api-${index}`,
                  title: title,
                  start: startTime.toISOString(),
                  end: endTime.toISOString(),
                  backgroundColor: event.backgroundColor || event.color || '',
                  description: event.description || '',
                  source: 'fullcalendar-api'
                });
              } catch (e) {
                console.warn(`Error processing API event ${index}:`, e);
              }
            });
          } else {
            // Fallback to DOM extraction
            console.log('Using DOM extraction method');
            
            const eventElements = document.querySelectorAll('a.fc-day-grid-event, .fc-event, .fc-list-item');
            console.log(`Found ${eventElements.length} event elements in DOM`);
            
            eventElements.forEach((eventEl, index) => {
              try {
                const element = eventEl as HTMLElement;
                
                const eventId = element.getAttribute('data-eventid') || 
                              element.getAttribute('data-id') || 
                              `dom-${index}`;
                
                // Get the title
                let title = '';
                const titleElement = element.querySelector('.fc-title, .fc-event-title, .fc-list-item-title');
                if (titleElement) {
                  title = titleElement.textContent?.trim() || '';
                } else {
                  title = element.textContent?.trim() || '';
                }
                
                // Clean title
                title = title.replace(/^\d{1,2}(:\d{2})?\s*[ap]m?\s*/i, '').trim() || 'Ice Session';
                
                // Get date from parent cell
                const dateCell = element.closest('[data-date]');
                let eventDate = new Date();
                
                if (dateCell) {
                  const dateStr = dateCell.getAttribute('data-date');
                  if (dateStr) {
                    eventDate = new Date(dateStr + 'T12:00:00'); // Default to noon in local time
                  }
                }
                
                // Look for time in the original element text
                const originalText = element.textContent || '';
                const timeMatch = originalText.match(/(\d{1,2}):(\d{2})\s*([ap])m?/i) || 
                                originalText.match(/(\d{1,2})\s*([ap])m?/i);
                
                let startTime: Date;
                let endTime: Date;
                
                if (timeMatch) {
                  let hours = parseInt(timeMatch[1]);
                  const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
                  const ampm = timeMatch[timeMatch.length - 1].toLowerCase();
                  
                  // Convert to 24-hour format
                  if (ampm === 'p' && hours !== 12) hours += 12;
                  if (ampm === 'a' && hours === 12) hours = 0;
                  
                  // Get the event date
                  const eventDateStr = dateCell?.getAttribute('data-date') || new Date().toISOString().split('T')[0];
                  const [year, month, day] = eventDateStr.split('-').map(Number);
                  
                  // Create date in Mountain Time (UTC-6 for daylight time in May)
                  // We'll create a UTC date and then adjust it
                  const utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));
                  // Add 6 hours to convert from Mountain Time to UTC for storage
                  startTime = new Date(utcDate.getTime() + 6 * 60 * 60 * 1000);
                  
                  // Default to 90 minutes duration
                  endTime = new Date(startTime.getTime() + 90 * 60 * 1000);
                  
                  // Debug: log what we created
                  console.log(`Time "${originalText}" -> MT: ${hours}:${minutes.toString().padStart(2,'0')} -> UTC: ${startTime.toISOString()}`);
                } else {
                  // If no time found, set to noon Mountain Time (6 PM UTC)
                  const eventDateStr = dateCell?.getAttribute('data-date') || new Date().toISOString().split('T')[0];
                  const [year, month, day] = eventDateStr.split('-').map(Number);
                  const utcDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
                  startTime = new Date(utcDate.getTime() + 6 * 60 * 60 * 1000);
                  endTime = new Date(startTime.getTime() + 90 * 60 * 1000);
                }
                
                // Get background color
                const computedStyle = window.getComputedStyle(element);
                const backgroundColor = computedStyle.backgroundColor || element.style.backgroundColor || '';
                
                events.push({
                  id: eventId,
                  title: title,
                  start: startTime.toISOString(),
                  end: endTime.toISOString(),
                  backgroundColor: backgroundColor,
                  description: '',
                  source: 'dom-extraction'
                });
                
              } catch (e) {
                console.warn(`Error processing DOM event ${index}:`, e);
              }
            });
          }
          
          return events;
        });
        
        console.log(`🎯 Extracted ${events.length} events from page`);
        
        // Debug: Log sample events with their times
        if (events.length > 0) {
          console.log('🔍 Sample events with times:');
          events.slice(0, 3).forEach((event: any, i: number) => {
            const start = new Date(event.start);
            const end = new Date(event.end);
            console.log(`   ${i + 1}. "${event.title}" - ${start.toLocaleString()} to ${end.toLocaleString()}`);
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
              
              return apiEvents.map((event: any, index: number) => {
                // Try to parse times correctly for Mountain Time zone
                let startTime: Date;
                let endTime: Date;
                
                try {
                  startTime = new Date(event.start || event.startTime);
                  endTime = new Date(event.end || event.endTime || event.start || event.startTime);
                  
                  // If end time is same as start time, add default duration
                  if (endTime.getTime() === startTime.getTime()) {
                    endTime = new Date(startTime.getTime() + 90 * 60 * 1000);
                  }
                } catch (dateError) {
                  console.warn(`Error parsing dates for event ${index}:`, dateError);
                  startTime = new Date();
                  endTime = new Date(startTime.getTime() + 90 * 60 * 1000);
                }
                
                return {
                  id: `${this.rinkId}-fallback-${event.id || index}`,
                  rinkId: this.rinkId,
                  title: this.cleanTitle(event.title || 'Ice Session'),
                  startTime,
                  endTime,
                  description: event.description || undefined,
                  category: this.categorizeBigBearEvent(event),
                  isFeatured: false,
                  eventUrl: event.url ? `${this.baseUrl}${event.url}` : undefined,
                };
              }).filter(event => !isNaN(event.startTime.getTime()));
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
