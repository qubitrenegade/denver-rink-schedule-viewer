import { RawIceEventData, EventCategory } from '../../src/types.js';
import { BaseScraper } from './base-scraper.js';
import puppeteer from 'puppeteer';

export class BigBearScraper extends BaseScraper {
  get rinkId(): string { return 'big-bear'; }
  get rinkName(): string { return 'Big Bear Ice Arena'; }

  private readonly baseUrl = 'https://bigbearicearena.ezfacility.com';

  protected categorizeBigBearEvent(event: any): EventCategory {
    const titleLower = event.title.toLowerCase();
    const backgroundColor = event.backgroundColor || '';

    // Use color coding and title analysis
    if (backgroundColor === '#9900FF' || backgroundColor === '#9900ff' || titleLower.includes('public skate')) return 'Public Skate';
    if (backgroundColor === '#FF66FF' || backgroundColor === '#ff66ff' || titleLower.includes('freestyle') || titleLower.includes('free style')) return 'Figure Skating';
    if (backgroundColor === '#00CC00' || backgroundColor === '#00cc00' || (titleLower.includes('stick') && titleLower.includes('puck'))) return 'Stick & Puck';
    if (backgroundColor === '#FF0000' || backgroundColor === '#ff0000' || backgroundColor === '#990000' || titleLower.includes('drop-in') || titleLower.includes('drop in')) return 'Drop-In Hockey';
    if (backgroundColor === '#000080' || titleLower.includes('party room')) return 'Special Event';
    if (backgroundColor === '#FFD700' || titleLower.includes('hockey party')) return 'Special Event';
    
    return this.categorizeEvent(event.title);
  }

  async scrape(): Promise<RawIceEventData[]> {
    try {
      console.log('🐻 Scraping Big Bear Ice Arena with Puppeteer...');
      
      const browser = await puppeteer.launch({
        headless: "new",
        executablePath: '/usr/bin/google-chrome-stable',
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
        await page.emulateTimezone('America/Denver');
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        console.log(`📄 Navigating to: ${this.baseUrl}/Sessions`);
        await page.goto(`${this.baseUrl}/Sessions`, { 
          waitUntil: 'networkidle2', 
          timeout: 30000 
        });
        
        console.log('⏳ Waiting for calendar to load...');
        await page.waitForSelector('#calendar', { timeout: 10000 });
        await page.waitForTimeout(3000);
        
        console.log('🔍 Extracting events from FullCalendar...');
        
        const events = await page.evaluate(() => {
          const events: any[] = [];
          
          // Try FullCalendar API first
          if (window && (window as any).$) {
            try {
              const $calendar = (window as any).$('#calendar');
              if ($calendar.length > 0 && typeof $calendar.fullCalendar === 'function') {
                const calendarEvents = $calendar.fullCalendar('clientEvents');
                console.log(`Found ${calendarEvents.length} events via FullCalendar API`);
                
                calendarEvents.forEach((event: any, index: number) => {
                  try {
                    const title = event.title || 'Unknown Event';
                    
                    // Get dates - FullCalendar should provide proper Date objects
                    let startTime = event.start;
                    let endTime = event.end;
                    
                    // Handle Moment.js objects and convert MT to UTC properly
                    if (startTime && startTime._d) {
                      // Moment object - get the time components
                      const momentDate = new Date(startTime._d);
                      const hours = momentDate.getHours();
                      const minutes = momentDate.getMinutes();
                      const year = momentDate.getFullYear();
                      const month = momentDate.getMonth();
                      const day = momentDate.getDate();
                      // Convert MT to UTC by adding 6 hours (MDT offset)
                      startTime = new Date(Date.UTC(year, month, day, hours + 6, minutes, 0));
                    } else if (startTime && startTime.toDate) {
                      const jsDate = startTime.toDate();
                      const hours = jsDate.getHours();
                      const minutes = jsDate.getMinutes();
                      const year = jsDate.getFullYear();
                      const month = jsDate.getMonth();
                      const day = jsDate.getDate();
                      startTime = new Date(Date.UTC(year, month, day, hours + 6, minutes, 0));
                    } else if (!(startTime instanceof Date)) {
                      startTime = new Date(startTime);
                    }
                    
                    if (endTime && endTime._d) {
                      const momentDate = new Date(endTime._d);
                      const hours = momentDate.getHours();
                      const minutes = momentDate.getMinutes();
                      const year = momentDate.getFullYear();
                      const month = momentDate.getMonth();
                      const day = momentDate.getDate();
                      endTime = new Date(Date.UTC(year, month, day, hours + 6, minutes, 0));
                    } else if (endTime && endTime.toDate) {
                      const jsDate = endTime.toDate();
                      const hours = jsDate.getHours();
                      const minutes = jsDate.getMinutes();
                      const year = jsDate.getFullYear();
                      const month = jsDate.getMonth();
                      const day = jsDate.getDate();
                      endTime = new Date(Date.UTC(year, month, day, hours + 6, minutes, 0));
                    } else if (!endTime || !(endTime instanceof Date)) {
                      endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // Default 60 minutes
                    }
                    
                    events.push({
                      id: event.id || `api-${index}`,
                      title: title,
                      start: startTime.toISOString(),
                      end: endTime.toISOString(),
                      backgroundColor: event.backgroundColor || event.color || '',
                      description: event.description || ''
                    });
                  } catch (e) {
                    console.warn(`Error processing API event ${index}:`, e);
                  }
                });
                
                return events;
              }
            } catch (e) {
              console.log('FullCalendar API not available, trying DOM extraction');
            }
          }
          
          // DOM extraction fallback
          const eventElements = document.querySelectorAll('a.fc-day-grid-event, .fc-event');
          console.log(`Found ${eventElements.length} event elements in DOM`);
          
          eventElements.forEach((eventEl, index) => {
            try {
              const element = eventEl as HTMLElement;
              const title = (element.querySelector('.fc-title')?.textContent || element.textContent || '').trim();
              
              if (!title) return;
              
              // Get date from parent cell
              const dateCell = element.closest('[data-date]');
              const dateStr = dateCell?.getAttribute('data-date') || new Date().toISOString().split('T')[0];
              
              // Extract time from title or default to noon
              const timeMatch = title.match(/(\d{1,2}):(\d{2})\s*([ap])m?/i);
              let hours = 12, minutes = 0;
              
              if (timeMatch) {
                hours = parseInt(timeMatch[1]);
                minutes = parseInt(timeMatch[2]);
                const ampm = timeMatch[3].toLowerCase();
                if (ampm === 'p' && hours !== 12) hours += 12;
                if (ampm === 'a' && hours === 12) hours = 0;
              }
              
              // Create date in Mountain Time (browser timezone is set to America/Denver)
              const [year, month, day] = dateStr.split('-').map(Number);
              const startTime = new Date(year, month - 1, day, hours, minutes, 0);
              const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
              
              const backgroundColor = window.getComputedStyle(element).backgroundColor || '';
              
              events.push({
                id: `dom-${index}`,
                title: title.replace(/^\d{1,2}:\d{2}\s*[ap]m?\s*/i, '').trim() || 'Ice Session',
                start: startTime.toISOString(),
                end: endTime.toISOString(),
                backgroundColor: backgroundColor,
                description: ''
              });
            } catch (e) {
              console.warn(`Error processing DOM event ${index}:`, e);
            }
          });
          
          return events;
        });
        
        console.log(`🎯 Extracted ${events.length} events from page`);
        
        // Process events
        const now = new Date();
        const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const fetchedEvents: RawIceEventData[] = [];
        
        events.forEach((event: any, index: number) => {
          try {
            let startTime: Date;
            let endTime: Date;
            
            // Convert Mountain Time components to proper UTC Date objects
            if (event.startHour !== undefined && event.startDateStr) {
              // Parse the date components
              const [year, month, day] = event.startDateStr.split('-').map(Number);
              
              // Create UTC date with Mountain Time offset
              // Mountain Daylight Time (MDT) is UTC-6, so add 6 hours to convert to UTC
              startTime = new Date(Date.UTC(
                year, 
                month - 1, // month is 0-indexed
                day, 
                event.startHour + 6, // Add 6 hours for MDT->UTC conversion
                event.startMinute || 0, 
                0, 
                0
              ));
              
              // Handle end time - need to handle date overflow
              if (event.endHour !== undefined) {
                let endYear = year;
                let endMonth = month - 1;
                let endDay = day;
                let endHour = event.endHour + 6; // Convert to UTC
                
                // Handle hour overflow past 24
                if (endHour >= 24) {
                  endHour = endHour - 24;
                  // Add one day
                  const tempDate = new Date(year, month - 1, day + 1);
                  endYear = tempDate.getFullYear();
                  endMonth = tempDate.getMonth();
                  endDay = tempDate.getDate();
                }
                
                endTime = new Date(Date.UTC(
                  endYear,
                  endMonth,
                  endDay,
                  endHour,
                  event.endMinute || 0,
                  0,
                  0
                ));
              } else {
                endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // Default 1 hour
              }
              
              console.log(`🕐 Converting: ${event.startHour}:${(event.startMinute || 0).toString().padStart(2, '0')} MT -> ${startTime.toISOString()} UTC`);
              console.log(`✅ Event "${this.cleanTitle(event.title || 'Ice Session')}": ${startTime.toLocaleString('en-US', {timeZone: 'America/Denver'})} MT`);
              
            } else {
              // Fallback for old format
              startTime = new Date(event.start);
              endTime = new Date(event.end);
            }
            
            // Validate and filter events
            if (!isNaN(startTime.getTime()) && 
                !isNaN(endTime.getTime()) && 
                startTime >= now && 
                startTime <= thirtyDaysFromNow) {
              
              fetchedEvents.push({
                id: `${this.rinkId}-${event.id}-${startTime.getTime()}`,
                rinkId: this.rinkId,
                title: this.cleanTitle(event.title || 'Ice Session'),
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
        
        console.log(`🐻 Big Bear final count: ${fetchedEvents.length} valid events`);
        return fetchedEvents.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
        
      } finally {
        await browser.close();
      }
      
    } catch (error) {
      console.error('❌ Big Bear scraping failed:', error);
      return [];
    }
  }
}
