import { RawIceEventData } from '../../src/types.js';
import { BaseScraper } from './base-scraper.js';
import { JSDOM } from 'jsdom';

export class IceRanchScraper extends BaseScraper {
  get rinkId(): string { return 'ice-ranch'; }
  get rinkName(): string { return 'Ice Ranch'; }

  private readonly baseUrl = 'https://www.theiceranch.com';

  // Parse time and properly handle Mountain Time zone
  private parseIceRanchTime(timeStr: string, baseDate: Date): Date {
    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*([ap]m)/i);
    if (!timeMatch) return baseDate;
    
    let hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);
    const ampm = timeMatch[3].toLowerCase();
    
    // Convert to 24-hour format
    if (ampm === 'pm' && hours !== 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;
    
    // Create date in Mountain Time, then convert to UTC for storage
    // Mountain Daylight Time (MDT) is UTC-6 during summer months
    // Mountain Standard Time (MST) is UTC-7 during winter months
    // Since we're dealing with current/future events, assume MDT (UTC-6)
    const result = new Date(baseDate);
    
    // Set the time as if it were UTC first
    result.setUTCHours(hours, minutes, 0, 0);
    
    // Then add 6 hours to convert from Mountain Time to UTC
    result.setTime(result.getTime() + (6 * 60 * 60 * 1000));
    
    return result;
  }

  async scrape(): Promise<RawIceEventData[]> {
    try {
      console.log('🏒 Scraping Ice Ranch...');
      const url = 'https://www.theiceranch.com/page/show/1652320-calendar';
      const html = await this.fetchWithFallback(url);
      
      const dom = new JSDOM(html);
      const doc = dom.window.document;
      
      const events: RawIceEventData[] = [];
      
      console.log('🔍 Parsing Ice Ranch calendar...');
      
      const calendarCells = doc.querySelectorAll('td');
      console.log(`   Found ${calendarCells.length} calendar cells`);
      
      let memorialDayFound = false;
      let eventsFound = 0;
      
      calendarCells.forEach((cell, cellIndex) => {
        const cellText = cell.textContent || '';
        
        if (cellText.trim().length < 10) return;
        
        // Check for Memorial Day or Closed events
        if (cellText.includes('Memorial Day') || cellText.includes('Closed')) {
          memorialDayFound = true;
          console.log(`🎯 Found Memorial Day/Closed in cell ${cellIndex}`);
          
          let eventDate = new Date();
          const dateLinks = cell.querySelectorAll('a[href*="/event/"]');
          let eventUrl: string | undefined;
          
          if (dateLinks.length > 0) {
            const link = dateLinks[0] as HTMLAnchorElement;
            const relativePath = link.href;
            // Convert relative path to full URL
            eventUrl = relativePath.startsWith('http') ? relativePath : `${this.baseUrl}${relativePath}`;
            
            const dateMatch = relativePath.match(/\/event\/\d+\/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
            if (dateMatch) {
              const [, year, month, day] = dateMatch;
              eventDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            }
          }
          
          events.push({
            id: `ice-ranch-memorial-${cellIndex}`,
            rinkId: this.rinkId,
            title: cellText.includes('Memorial Day') ? 'Closed: Memorial Day' : 'Rink Closed',
            startTime: eventDate,
            endTime: new Date(eventDate.getTime() + 24 * 60 * 60 * 1000),
            category: 'Special Event',
            description: `Holiday closure`,
            eventUrl: eventUrl
          });
          
          eventsFound++;
        }
        
        // Look for regular time patterns like "3:15pm MDT-4:45pm MDT"
        const timeMatches = cellText.match(/(\d{1,2}:\d{2}[ap]m)\s+\w+-(\d{1,2}:\d{2}[ap]m)\s+\w+/gi);
        
        if (timeMatches) {
          let eventDate = new Date();
          const dateLinks = cell.querySelectorAll('a[href*="/event/"]');
          let eventUrl: string | undefined;
          
          if (dateLinks.length > 0) {
            const link = dateLinks[0] as HTMLAnchorElement;
            const relativePath = link.href;
            // Convert relative path to full URL
            eventUrl = relativePath.startsWith('http') ? relativePath : `${this.baseUrl}${relativePath}`;
            
            const dateMatch = relativePath.match(/\/event\/\d+\/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
            if (dateMatch) {
              const [, year, month, day] = dateMatch;
              eventDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            }
          }
          
          timeMatches.forEach((timeMatch, timeIndex) => {
            // Parse pattern like "3:15pm MDT-4:45pm MDT"
            const timePattern = /(\d{1,2}:\d{2}[ap]m)\s+\w+-(\d{1,2}:\d{2}[ap]m)\s+\w+/i;
            const timeMatchResult = timeMatch.match(timePattern);
            
            if (timeMatchResult) {
              const [, startTimeStr, endTimeStr] = timeMatchResult;
              
              console.log(`🕐 Ice Ranch parsing: "${timeMatch}"`);
              console.log(`   Extracting: ${startTimeStr} to ${endTimeStr} (Mountain Time)`);
              
              // Parse times with proper timezone handling
              const startTime = this.parseIceRanchTime(startTimeStr, eventDate);
              const endTime = this.parseIceRanchTime(endTimeStr, eventDate);
              
              console.log(`   ✅ Converted to UTC: ${startTime.toISOString()} to ${endTime.toISOString()}`);
              console.log(`   📍 Mountain Time equivalent: ${startTime.toLocaleString('en-US', {timeZone: 'America/Denver'})} to ${endTime.toLocaleString('en-US', {timeZone: 'America/Denver'})}`);
              
              // Extract event title
              let title = 'Ice Time';
              const lines = cellText.split('\n').map(l => l.trim()).filter(l => l);
              
              for (const line of lines) {
                if (!line.match(/\d{1,2}:\d{2}[ap]m/) && 
                    line.length > 5 && 
                    line.length < 80 &&
                    !line.includes('Click Location') &&
                    !line.includes('Tag(s):') &&
                    !line.includes('Event Category:') &&
                    !line.includes('The Ice Ranch')) {
                  
                  const cleanTitle = this.cleanTitle(line);
                  if (cleanTitle.length > 3) {
                    title = cleanTitle;
                    break;
                  }
                }
              }
              
              events.push({
                id: `ice-ranch-${eventDate.getTime()}-${cellIndex}-${timeIndex}`,
                rinkId: this.rinkId,
                title: title,
                startTime: startTime,
                endTime: endTime,
                category: this.categorizeEvent(title),
                description: `Scraped from Ice Ranch calendar`,
                eventUrl: eventUrl
              });
              
              eventsFound++;
            }
          });
        }
      });
      
      console.log(`🎯 Memorial Day found: ${memorialDayFound}`);
      console.log(`📅 Total events found: ${eventsFound}`);
      
      events.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      return events;
      
    } catch (error) {
      console.error('❌ Ice Ranch scraping failed:', error.message);
      throw error;
    }
  }
}
