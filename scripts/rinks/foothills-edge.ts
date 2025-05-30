// Foothills Edge scraper: fetches and parses events from the Edge calendar
import { RawIceEventData, EventCategory } from '../../src/types.js';
import { BaseScraper } from './base-scraper.js';
import { JSDOM } from 'jsdom';

export class FoothillsEdgeScraper extends BaseScraper {
  get rinkId() { return 'foothills-edge'; }
  get rinkName() { return 'Foothills Ice Arena (Edge)'; }
  private readonly calendarUrl = 'https://calendar.ifoothills.org/calendars/edge-ice-arena-drop.php';

  // Parse time and handle Mountain Time zone
  private parseFoothillsTime(timeStr: string, baseDate: Date): Date {
    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*([AP])\.?M\.?/i);
    if (!timeMatch) return baseDate;
    let hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);
    const ampm = timeMatch[3].toLowerCase();
    if (ampm === 'p' && hours !== 12) hours += 12;
    if (ampm === 'a' && hours === 12) hours = 0;
    const result = new Date(baseDate);
    result.setUTCHours(hours, minutes, 0, 0);
    result.setTime(result.getTime() + (6 * 60 * 60 * 1000));
    return result;
  }

  // Enhanced categorization for Edge-specific events
  protected categorizeEdgeEvent(title: string): EventCategory {
    const titleLower = title.toLowerCase().trim();
    
    // Edge-specific patterns from the data
    if (titleLower.includes('drop') && titleLower.includes('hockey')) {
      return 'Drop-In Hockey';
    }
    
    if (titleLower.includes('stick') && titleLower.includes('puck')) {
      return 'Stick & Puck';
    }
    
    if (titleLower.includes('public skate')) {
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

  private extractEventsFromJavaScript(html: string): RawIceEventData[] {
    const events: RawIceEventData[] = [];
    
    // Look for the events assignment with data (not the empty declaration)
    // Pattern: events = {"2025-05-22":[...
    const eventsStartMatch = html.match(/events\s*=\s*\{"[0-9]{4}-[0-9]{2}-[0-9]{2}"/);
    if (!eventsStartMatch) {
      // Debug: show what we can find
      const anyEventsMatch = html.match(/events\s*=\s*[^;]*/g);
      if (anyEventsMatch) {
        console.log(`   📋 Found ${anyEventsMatch.length} events assignments:`);
        anyEventsMatch.forEach((match, i) => {
          console.log(`     ${i + 1}. ${match.substring(0, 50)}...`);
        });
      }
      return events;
    }
    
    try {
      // Find the start of the object (the opening brace)
      const startIndex = eventsStartMatch.index! + eventsStartMatch[0].indexOf('{');
      
      // Find the matching closing brace
      let braceCount = 0;
      let endIndex = startIndex;
      
      for (let i = startIndex; i < html.length; i++) {
        if (html[i] === '{') braceCount++;
        if (html[i] === '}') braceCount--;
        if (braceCount === 0) {
          endIndex = i;
          break;
        }
      }
      
      // Extract the full object string
      const eventsDataStr = html.substring(startIndex, endIndex + 1);
      
      // Parse the JavaScript object using JSON.parse
      const eventsData = JSON.parse(eventsDataStr);
      
      // Process each date and its events
      // Fix Object.entries typing for eventsData
      Object.entries(eventsData as Record<string, any[]>).forEach(([dateStr, dayEvents]) => {
        
        // Parse the date (YYYY-MM-DD format)
        const [year, month, day] = dateStr.split('-').map(Number);
        const eventDate = new Date(year, month - 1, day); // month is 0-indexed
        
        dayEvents.forEach((event: any, index: number) => {
          try {
            const title = event.name || 'Ice Activity';
            const timeIn = event.TimeIn || '12:00 PM';
            const timeOut = event.TimeOut || '1:30 PM';
            
            // Parse start and end times
            const startTime = this.parseFoothillsTime(timeIn, eventDate);
            const endTime = this.parseFoothillsTime(timeOut, eventDate);
            
            // Validate that end time is after start time
            if (endTime <= startTime) {
              console.warn(`     ⚠️ Invalid time range for "${title}": ${timeIn} - ${timeOut}`);
              return;
            }
            
            const eventId = `${this.rinkId}-${dateStr}-${index}`;
            
            events.push({
              id: eventId,
              rinkId: this.rinkId,
              title: this.cleanTitle(title),
              startTime: startTime,
              endTime: endTime,
              category: this.categorizeEdgeEvent(title),
              description: `Ice activity at Foothills Edge Ice Arena`,
              isFeatured: false
            });
            
          } catch (error) {
            console.warn(`     ❌ Error processing event ${index} on ${dateStr}:`, error);
          }
        });
      });
      
    } catch (error) {
      console.error('   ❌ Error parsing JavaScript events data:', error);
    }
    
    return events;
  }

  async scrape(): Promise<RawIceEventData[]> {
    try {
      console.log('⛸️ Scraping Foothills Edge Ice Arena...');
      console.log(`   📡 Fetching calendar from: ${this.calendarUrl}`);
      
      const html = await this.fetchWithFallback(this.calendarUrl);
      
      // Extract events from the JavaScript data
      const events = this.extractEventsFromJavaScript(html);
      
      if (events.length === 0) {
        console.log('   🔍 No JavaScript events found, trying DOM parsing as fallback...');
        return this.fallbackDomParsing(html);
      }
      
      // Filter to reasonable date range (next 30 days)
      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      const filteredEvents = events.filter(event => 
        event.startTime >= now && 
        event.startTime <= thirtyDaysFromNow &&
        event.endTime > event.startTime
      );
      
      console.log(`⛸️ Foothills Edge: Found ${filteredEvents.length} valid events (${events.length} total)`);
      
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

  private fallbackDomParsing(html: string): RawIceEventData[] {
    console.log('   🔄 Using DOM parsing fallback...');
    
    try {
      const dom = new JSDOM(html);
      const doc = dom.window.document;
      
      // Look for any time patterns in the text content
      const allText = doc.body?.textContent || '';
      const timePattern = /(\d{1,2}:\d{2}\s*[AP]\.?M\.?)\s*[-–—]\s*(\d{1,2}:\d{2}\s*[AP]\.?M\.?)/gi;
      const timeMatches = allText.match(timePattern);
      
      if (timeMatches) {
        const events: RawIceEventData[] = [];
        const today = new Date();
        
        timeMatches.forEach((timeMatch, index) => {
          const match = timeMatch.match(/(\d{1,2}:\d{2}\s*[AP]\.?M\.?)\s*[-–—]\s*(\d{1,2}:\d{2}\s*[AP]\.?M\.?)/i);
          
          if (match) {
            const [, startTimeStr, endTimeStr] = match;
            
            const startTime = this.parseFoothillsTime(startTimeStr, today);
            const endTime = this.parseFoothillsTime(endTimeStr, today);
            
            events.push({
              id: `${this.rinkId}-fallback-${index}`,
              rinkId: this.rinkId,
              title: 'Ice Activity',
              startTime: startTime,
              endTime: endTime,
              category: 'Public Skate',
              description: `Ice activity at Foothills Edge Ice Arena`
            });
          }
        });
        
        return events;
      }
      
    } catch (error) {
      console.warn('   ⚠️ DOM parsing fallback failed:', error);
    }
    
    return [];
  }
}
