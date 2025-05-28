import { RawIceEventData, EventCategory } from '../../src/types.js';
import { BaseScraper } from './base-scraper.js';
import { JSDOM } from 'jsdom';

export class FoothillsEdgeScraper extends BaseScraper {
  get rinkId(): string { return 'foothills-edge'; }
  get rinkName(): string { return 'Foothills Ice Arena (Edge)'; }

  private readonly calendarUrl = 'https://calendar.ifoothills.org/calendars/edge-ice-arena-drop.php';

  // Parse time and properly handle Mountain Time zone (same logic as Ice Ranch)
  private parseFoothillsTime(timeStr: string, baseDate: Date): Date {
    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*([ap])\.?m\.?/i);
    if (!timeMatch) return baseDate;
    
    let hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);
    const ampm = timeMatch[3].toLowerCase();
    
    // Convert to 24-hour format
    if (ampm === 'p' && hours !== 12) hours += 12;
    if (ampm === 'a' && hours === 12) hours = 0;
    
    // Create date in Mountain Time, then convert to UTC for storage
    const result = new Date(baseDate);
    result.setUTCHours(hours, minutes, 0, 0);
    result.setTime(result.getTime() + (6 * 60 * 60 * 1000)); // Add 6 hours for MDT->UTC
    
    return result;
  }

  // Enhanced categorization for Edge-specific events
  protected categorizeEdgeEvent(title: string, description?: string): EventCategory {
    const titleLower = title.toLowerCase().trim();
    
    console.log(`   🏷️ Categorizing Edge event: "${title}"`);
    
    // Edge-specific patterns
    if (titleLower.includes('drop-in hockey') || titleLower.includes('drop in hockey')) {
      return 'Drop-In Hockey';
    }
    
    if (titleLower.includes('stick') && titleLower.includes('puck')) {
      return 'Stick & Puck';
    }
    
    if (titleLower.includes('public skate') || titleLower.includes('open skate')) {
      return 'Public Skate';
    }
    
    if (titleLower.includes('figure skating') || titleLower.includes('freestyle')) {
      return 'Figure Skating';
    }
    
    if (titleLower.includes('learn to skate') || titleLower.includes('skating lessons')) {
      return 'Learn to Skate';
    }
    
    if (titleLower.includes('hockey practice') || titleLower.includes('practice')) {
      return 'Hockey Practice';
    }
    
    if (titleLower.includes('hockey league') || titleLower.includes('league')) {
      return 'Hockey League';
    }
    
    if (titleLower.includes('closed') || titleLower.includes('maintenance')) {
      return 'Special Event';
    }
    
    // Use base categorization as fallback
    return this.categorizeEvent(title);
  }

  private parseCalendarTable(doc: Document): RawIceEventData[] {
    const events: RawIceEventData[] = [];
    
    // Look for calendar table structures
    const tables = doc.querySelectorAll('table');
    console.log(`   �� Found ${tables.length} tables in calendar`);
    
    tables.forEach((table, tableIndex) => {
      const rows = table.querySelectorAll('tr');
      console.log(`   📋 Table ${tableIndex}: ${rows.length} rows`);
      
      rows.forEach((row, rowIndex) => {
        const cells = row.querySelectorAll('td, th');
        
        cells.forEach((cell, cellIndex) => {
          const cellText = cell.textContent?.trim() || '';
          
          // Skip empty cells or header cells
          if (cellText.length < 5) return;
          
          // Look for time patterns
          const timePattern = /(\d{1,2}:\d{2}\s*[ap]\.?m\.?)\s*[-–—]\s*(\d{1,2}:\d{2}\s*[ap]\.?m\.?)/i;
          const timeMatch = cellText.match(timePattern);
          
          if (timeMatch) {
            const [, startTimeStr, endTimeStr] = timeMatch;
            
            // Try to extract date from various sources
            let eventDate = new Date();
            
            // Look for date in cell attributes or nearby cells
            const dateAttr = cell.getAttribute('data-date') || 
                           cell.getAttribute('date') ||
                           row.getAttribute('data-date');
            
            if (dateAttr) {
              eventDate = new Date(dateAttr);
            } else {
              // Look for date patterns in the text
              const datePattern = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})|(\d{4})-(\d{1,2})-(\d{1,2})/;
              const dateMatch = cellText.match(datePattern);
              
              if (dateMatch) {
                if (dateMatch[1]) {
                  // MM/DD/YYYY format
                  eventDate = new Date(parseInt(dateMatch[3]) + (dateMatch[3].length === 2 ? 2000 : 0), 
                                     parseInt(dateMatch[1]) - 1, 
                                     parseInt(dateMatch[2]));
                } else if (dateMatch[4]) {
                  // YYYY-MM-DD format
                  eventDate = new Date(parseInt(dateMatch[4]), 
                                     parseInt(dateMatch[5]) - 1, 
                                     parseInt(dateMatch[6]));
                }
              }
            }
            
            // Parse times
            const startTime = this.parseFoothillsTime(startTimeStr, eventDate);
            const endTime = this.parseFoothillsTime(endTimeStr, eventDate);
            
            // Extract title (remove time strings and clean up)
            let title = cellText
              .replace(timePattern, '')
              .replace(/[-–—]\s*$/, '')
              .trim();
            
            // Clean up title
            title = this.cleanTitle(title) || 'Ice Activity';
            
            console.log(`   ➕ Edge event: "${title}" ${startTime.toLocaleString('en-US', {timeZone: 'America/Denver'})}`);
            
            events.push({
              id: `${this.rinkId}-${eventDate.getTime()}-${tableIndex}-${rowIndex}-${cellIndex}`,
              rinkId: this.rinkId,
              title: title,
              startTime: startTime,
              endTime: endTime,
              category: this.categorizeEdgeEvent(title),
              description: `Ice activity at Foothills Edge Ice Arena`,
              isFeatured: false
            });
          }
        });
      });
    });
    
    return events;
  }

  private parseCalendarList(doc: Document): RawIceEventData[] {
    const events: RawIceEventData[] = [];
    
    // Look for list-based calendar structures
    const listItems = doc.querySelectorAll('li, .event, .calendar-item, .schedule-item');
    console.log(`   📋 Found ${listItems.length} potential list items`);
    
    listItems.forEach((item, index) => {
      const itemText = item.textContent?.trim() || '';
      
      if (itemText.length < 10) return;
      
      // Look for time patterns
      const timePattern = /(\d{1,2}:\d{2}\s*[ap]\.?m\.?)\s*[-–—]\s*(\d{1,2}:\d{2}\s*[ap]\.?m\.?)/i;
      const timeMatch = itemText.match(timePattern);
      
      if (timeMatch) {
        const [, startTimeStr, endTimeStr] = timeMatch;
        
        // Try to extract date
        let eventDate = new Date();
        const datePattern = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})|(\d{4})-(\d{1,2})-(\d{1,2})/;
        const dateMatch = itemText.match(datePattern);
        
        if (dateMatch) {
          if (dateMatch[1]) {
            eventDate = new Date(parseInt(dateMatch[3]) + (dateMatch[3].length === 2 ? 2000 : 0), 
                               parseInt(dateMatch[1]) - 1, 
                               parseInt(dateMatch[2]));
          } else if (dateMatch[4]) {
            eventDate = new Date(parseInt(dateMatch[4]), 
                               parseInt(dateMatch[5]) - 1, 
                               parseInt(dateMatch[6]));
          }
        }
        
        const startTime = this.parseFoothillsTime(startTimeStr, eventDate);
        const endTime = this.parseFoothillsTime(endTimeStr, eventDate);
        
        let title = itemText
          .replace(timePattern, '')
          .replace(datePattern, '')
          .trim();
        
        title = this.cleanTitle(title) || 'Ice Activity';
        
        events.push({
          id: `${this.rinkId}-list-${eventDate.getTime()}-${index}`,
          rinkId: this.rinkId,
          title: title,
          startTime: startTime,
          endTime: endTime,
          category: this.categorizeEdgeEvent(title),
          description: `Ice activity at Foothills Edge Ice Arena`
        });
      }
    });
    
    return events;
  }

  async scrape(): Promise<RawIceEventData[]> {
    try {
      console.log('⛸️ Scraping Foothills Edge Ice Arena...');
      console.log(`   📡 Fetching calendar from: ${this.calendarUrl}`);
      
      const html = await this.fetchWithFallback(this.calendarUrl);
      
      const dom = new JSDOM(html);
      const doc = dom.window.document;
      
      console.log('🔍 Parsing Edge calendar content...');
      
      let events: RawIceEventData[] = [];
      
      // Try table-based parsing first
      const tableEvents = this.parseCalendarTable(doc);
      if (tableEvents.length > 0) {
        console.log(`   ✅ Found ${tableEvents.length} events in table format`);
        events = tableEvents;
      } else {
        // Try list-based parsing
        const listEvents = this.parseCalendarList(doc);
        if (listEvents.length > 0) {
          console.log(`   ✅ Found ${listEvents.length} events in list format`);
          events = listEvents;
        }
      }
      
      // If no structured events found, look for any text with time patterns
      if (events.length === 0) {
        console.log('   🔍 No structured events found, parsing raw text...');
        
        const allText = doc.body?.textContent || '';
        const timePattern = /(\d{1,2}:\d{2}\s*[ap]\.?m\.?)\s*[-–—]\s*(\d{1,2}:\d{2}\s*[ap]\.?m\.?)/gi;
        const timeMatches = allText.match(timePattern);
        
        if (timeMatches) {
          console.log(`   📋 Found ${timeMatches.length} time patterns in text`);
          
          timeMatches.forEach((timeMatch, index) => {
            const timePattern = /(\d{1,2}:\d{2}\s*[ap]\.?m\.?)\s*[-–—]\s*(\d{1,2}:\d{2}\s*[ap]\.?m\.?)/i;
            const match = timeMatch.match(timePattern);
            
            if (match) {
              const [, startTimeStr, endTimeStr] = match;
              const today = new Date();
              
              const startTime = this.parseFoothillsTime(startTimeStr, today);
              const endTime = this.parseFoothillsTime(endTimeStr, today);
              
              events.push({
                id: `${this.rinkId}-text-${index}`,
                rinkId: this.rinkId,
                title: 'Ice Activity',
                startTime: startTime,
                endTime: endTime,
                category: 'Public Skate',
                description: `Ice activity at Foothills Edge Ice Arena`
              });
            }
          });
        }
      }
      
      // Filter to reasonable date range (next 30 days)
      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      const filteredEvents = events.filter(event => 
        event.startTime >= now && 
        event.startTime <= thirtyDaysFromNow &&
        event.endTime > event.startTime
      );
      
      console.log(`⛸️ Foothills Edge: Found ${filteredEvents.length} valid events`);
      
      // Debug: Show sample events
      if (filteredEvents.length > 0) {
        console.log('🔍 Sample Edge events:');
        filteredEvents.slice(0, 3).forEach((event, i) => {
          console.log(`   ${i + 1}. "${event.title}" - ${event.startTime.toLocaleString('en-US', {timeZone: 'America/Denver'})} (${event.category})`);
        });
      }
      
      filteredEvents.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      return filteredEvents;
      
    } catch (error) {
      console.error('❌ Foothills Edge scraping failed:', error);
      return [];
    }
  }
}

