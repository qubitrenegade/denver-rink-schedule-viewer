import { RawIceEventData, EventCategory } from '../../src/types.js';
import { BaseScraper } from './base-scraper.js';
import puppeteer from 'puppeteer';

export class BigBearScraper extends BaseScraper {
  get rinkId(): string { return 'big-bear'; }
  get rinkName(): string { return 'Big Bear Ice Arena'; }

  private readonly baseUrl = 'https://bigbearicearena.ezfacility.com';

  protected categorizeBigBearEvent(title: string): EventCategory {
    const titleLower = title.toLowerCase();
    
    if (titleLower.includes('public skate')) return 'Public Skate';
    if (titleLower.includes('freestyle') || titleLower.includes('free style')) return 'Figure Skating';
    if (titleLower.includes('stick') && titleLower.includes('puck')) return 'Stick & Puck';
    if (titleLower.includes('drop-in') || titleLower.includes('drop in')) return 'Drop-In Hockey';
    if (titleLower.includes('party room') || titleLower.includes('hockey party')) return 'Special Event';
    
    return this.categorizeEvent(title);
  }

  // Convert Mountain Time to UTC
  private convertMTtoUTC(dateStr: string, timeStr: string): Date {
    // Parse date: "2025-05-29"
    const [year, month, day] = dateStr.split('-').map(Number);
    
    // Parse time: "6a", "8:45p", "10:30a", etc.
    const timeMatch = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*([ap])(?:m)?/i);
    if (!timeMatch) {
      console.warn(`Could not parse time: ${timeStr}`);
      return new Date();
    }
    
    let hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2] || '0');
    const ampm = timeMatch[3].toLowerCase();
    
    // Convert to 24-hour format
    if (ampm === 'p' && hours !== 12) hours += 12;
    if (ampm === 'a' && hours === 12) hours = 0;
    
    // Create UTC date: MT time + 6 hours = UTC time (for MDT)
    const utcDate = new Date(Date.UTC(year, month - 1, day, hours + 6, minutes, 0, 0));
    
    console.log(`   Converting ${timeStr} MT on ${dateStr} -> ${utcDate.toISOString()} UTC`);
    
    return utcDate;
  }

  // Parse the popover content to extract duration and venue
  private parsePopoverContent(content: string): { duration: number; venue?: string } {
    let duration = 60; // default 1 hour
    let venue: string | undefined;
    
    // Extract duration: "2 hour(s) 15 minutes" or "1 hour(s)"
    const durationMatch = content.match(/(\d+)\s+hour\(s\)(?:\s+(\d+)\s+minutes)?/);
    if (durationMatch) {
      const hours = parseInt(durationMatch[1]);
      const minutes = parseInt(durationMatch[2] || '0');
      duration = hours * 60 + minutes;
    }
    
    // Extract venue: "Venues - South Rink" or "Venues - North Rink"
    const venueMatch = content.match(/Venues\s*-\s*([^<]+)/);
    if (venueMatch) {
      venue = venueMatch[1].trim();
    }
    
    return { duration, venue };
  }

  async scrape(): Promise<RawIceEventData[]> {
    try {
      console.log('🐻 Scraping Big Bear Ice Arena...');
      
      const browser = await puppeteer.launch({
        headless: "new",
        executablePath: '/usr/bin/google-chrome-stable',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ]
      });
      
      try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        
        console.log(`📄 Loading: ${this.baseUrl}/Sessions`);
        await page.goto(`${this.baseUrl}/Sessions`, { 
          waitUntil: 'networkidle2', 
          timeout: 30000 
        });
        
        console.log('⏳ Waiting for calendar...');
        await page.waitForSelector('#calendar', { timeout: 15000 });
        await page.waitForTimeout(3000);
        
        console.log('🔍 Extracting events from FullCalendar...');
        
        const eventData = await page.evaluate(() => {
          const events: any[] = [];
          
          // Find all FullCalendar event elements
          const eventElements = document.querySelectorAll('.fc-day-grid-event');
          console.log(`Found ${eventElements.length} event elements`);
          
          eventElements.forEach((eventEl, index) => {
            try {
              // Get event title
              const titleEl = eventEl.querySelector('.fc-title');
              if (!titleEl) return;
              const title = titleEl.textContent?.trim() || '';
              
              // Get event time
              const timeEl = eventEl.querySelector('.fc-time');
              if (!timeEl) return;
              const timeStr = timeEl.textContent?.trim() || '';
              
              // Find date by looking at column position in FullCalendar
              let dateStr = '';
              
              // Method 1: Try to find date from the table structure
              const eventCell = eventEl.closest('td.fc-event-container');
              if (eventCell) {
                // Find the parent row and get cell index
                const row = eventCell.closest('tr');
                if (row) {
                  const cells = Array.from(row.querySelectorAll('td'));
                  const cellIndex = cells.indexOf(eventCell as HTMLTableCellElement);
                  
                  // Look for the header row with dates
                  const contentSkeleton = eventCell.closest('.fc-content-skeleton');
                  if (contentSkeleton) {
                    const headCells = contentSkeleton.querySelectorAll('thead .fc-day-top[data-date]');
                    if (headCells[cellIndex]) {
                      dateStr = headCells[cellIndex].getAttribute('data-date') || '';
                    }
                  }
                }
              }
              
              // Method 2: If that fails, try to find from background table
              if (!dateStr) {
                const dayGrid = eventEl.closest('.fc-day-grid');
                if (dayGrid) {
                  const bgTable = dayGrid.querySelector('.fc-bg table');
                  if (bgTable) {
                    const bgCells = bgTable.querySelectorAll('td[data-date]');
                    // Try to match position or just take today/future dates
                    for (const bgCell of bgCells) {
                      const cellDate = bgCell.getAttribute('data-date');
                      if (cellDate && !bgCell.classList.contains('fc-past')) {
                        dateStr = cellDate;
                        break; // Take the first non-past date as fallback
                      }
                    }
                  }
                }
              }
              
              // Method 3: Last resort - extract from current date context
              if (!dateStr) {
                const today = new Date();
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                dateStr = tomorrow.toISOString().split('T')[0]; // Default to tomorrow
                console.warn(`Using fallback date ${dateStr} for event: ${title}`);
              }
              
              if (!dateStr) {
                console.warn(`Could not find date for event: ${title}`);
                return;
              }
              
              // Get popover content for duration and venue
              const popoverContent = eventEl.getAttribute('data-content') || '';
              
              // Get event ID
              const eventId = eventEl.getAttribute('data-eventid') || `bb-${index}`;
              
              events.push({
                title,
                timeStr,
                dateStr,
                popoverContent,
                eventId,
                index
              });
              
              console.log(`Event ${index}: "${title}" at ${timeStr} on ${dateStr}`);
              
            } catch (error) {
              console.warn(`Error processing event ${index}:`, error);
            }
          });
          
          return events;
        });
        
        console.log(`🎯 Found ${eventData.length} raw events from FullCalendar`);
        
        const processedEvents: RawIceEventData[] = [];
        
        eventData.forEach((event, index) => {
          try {
            const { title, timeStr, dateStr, popoverContent, eventId } = event;
            
            // Parse start time
            const startTime = this.convertMTtoUTC(dateStr, timeStr);
            
            // Parse duration and venue from popover content
            const { duration, venue } = this.parsePopoverContent(popoverContent);
            
            // Calculate end time
            const endTime = new Date(startTime.getTime() + duration * 60 * 1000);
            
            // Filter for reasonable time range (next 30 days)
            const now = new Date();
            const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            
            if (startTime < now || startTime > thirtyDaysFromNow) {
              return; // Skip events outside our range
            }
            
            // Create the event
            const processedEvent: RawIceEventData = {
              id: `${this.rinkId}-${eventId}`,
              rinkId: this.rinkId,
              title: this.cleanTitle(title),
              startTime: startTime,
              endTime: endTime,
              category: this.categorizeBigBearEvent(title),
              description: venue ? `${venue} - ${duration} minutes` : `${duration} minutes`,
              isFeatured: false
            };
            
            processedEvents.push(processedEvent);
            
            console.log(`   ✅ Processed: "${processedEvent.title}" at ${startTime.toLocaleString('en-US', {timeZone: 'America/Denver'})} MT`);
            
          } catch (error) {
            console.warn(`   ❌ Error processing event ${index}:`, error);
          }
        });
        
        console.log(`🐻 Big Bear: Successfully processed ${processedEvents.length} events`);
        
        // Sort by start time
        processedEvents.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
        
        return processedEvents;
        
      } finally {
        await browser.close();
      }
      
    } catch (error) {
      console.error('❌ Big Bear scraping failed:', error);
      return [];
    }
  }
}
