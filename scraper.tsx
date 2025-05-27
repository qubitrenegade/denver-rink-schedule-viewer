import { RawIceEventData, EventCategory } from './types';

export class RealRinkScraper {
  private proxyUrls = [
    'https://api.allorigins.win/get?url=', // Working manually ✅
    'https://api.codetabs.com/v1/proxy?quest=', // Working manually ✅  
  ];

  private async fetchWithFallback(url: string): Promise<string> {
    const errors = [];
    
    for (const proxyUrl of this.proxyUrls) {
      try {
        console.log(`🔄 Trying proxy: ${proxyUrl}`);
        
        let fetchUrl: string;
        
        // Build the correct URL based on proxy format
        if (proxyUrl.includes('allorigins')) {
          fetchUrl = `${proxyUrl}${encodeURIComponent(url)}`;
        } else if (proxyUrl.includes('codetabs')) {
          fetchUrl = `${proxyUrl}${encodeURIComponent(url)}`;
        } else {
          fetchUrl = `${proxyUrl}${url}`;
        }
        
        console.log(`   Full URL: ${fetchUrl}`);
        
        const fetchStart = Date.now();
        
        // Simplified fetch - no custom headers that cause CORS issues
        const response = await fetch(fetchUrl, {
          method: 'GET',
          mode: 'cors',
          credentials: 'omit',
          // NO CUSTOM HEADERS - they cause CORS preflight failures
        });
        
        const fetchTime = Date.now() - fetchStart;
        console.log(`   📡 Response: ${response.status} after ${fetchTime}ms`);
        
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Could not read error');
          throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 100)}`);
        }
        
        let html: string;
        
        if (proxyUrl.includes('allorigins')) {
          const data = await response.json();
          console.log(`   📊 AllOrigins response keys: ${Object.keys(data).join(', ')}`);
          
          if (data.contents) {
            html = data.contents;
            console.log(`   ✅ SUCCESS! Got ${html.length} chars of HTML`);
            return html;
          } else if (data.status?.http_code) {
            throw new Error(`Target HTTP ${data.status.http_code}: ${data.status.error_message || 'Unknown'}`);
          } else {
            throw new Error('No contents in allorigins response');
          }
        } else {
          // Direct HTML response (codetabs)
          html = await response.text();
          console.log(`   ✅ SUCCESS! Got ${html.length} chars of HTML`);
          return html;
        }
        
      } catch (error) {
        const errorMsg = `${proxyUrl}: ${error.message}`;
        console.log(`   ❌ Failed: ${error.message}`);
        errors.push(errorMsg);
      }
    }
    
    throw new Error(`All proxies failed: ${errors.join('; ')}`);
  }

  async scrapeTheIceRanch(): Promise<RawIceEventData[]> {
    try {
      console.log('🏒 Scraping Ice Ranch...');
      const url = 'https://www.theiceranch.com/page/show/1652320-calendar';
      const html = await this.fetchWithFallback(url);
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      const events: RawIceEventData[] = [];
      
      console.log('🔍 Parsing Ice Ranch calendar...');
      
      // Ice Ranch uses a calendar table - look for td elements with event data
      const calendarCells = doc.querySelectorAll('td');
      console.log(`   Found ${calendarCells.length} calendar cells`);
      
      let memorialDayFound = false;
      let eventsFound = 0;
      
      calendarCells.forEach((cell, cellIndex) => {
        const cellText = cell.textContent || '';
        
        // Skip cells that are too short (probably just day numbers)
        if (cellText.trim().length < 10) return;
        
        // Check for Memorial Day or Closed events
        if (cellText.includes('Memorial Day') || cellText.includes('Closed')) {
          memorialDayFound = true;
          console.log(`🎯 Found Memorial Day/Closed in cell ${cellIndex}`);
          console.log(`   Content: "${cellText.trim().substring(0, 100)}..."`);
          
          // Extract date from the cell or links
          let eventDate = new Date();
          const dateLinks = cell.querySelectorAll('a[href*="/event/"]');
          if (dateLinks.length > 0) {
            const link = dateLinks[0] as HTMLAnchorElement;
            const dateMatch = link.href.match(/\/event\/\d+\/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
            if (dateMatch) {
              const [, year, month, day] = dateMatch;
              eventDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            }
          }
          
          events.push({
            id: `ice-ranch-memorial-${cellIndex}`,
            rinkId: 'ice-ranch',
            title: cellText.includes('Memorial Day') ? 'Closed: Memorial Day' : 'Rink Closed',
            startTime: eventDate,
            endTime: new Date(eventDate.getTime() + 24 * 60 * 60 * 1000), // All day
            category: 'Special Event',
            description: `Holiday closure - ${cellText.trim()}`
          });
          
          eventsFound++;
        }
        
        // Look for regular time patterns like "3:15pm MDT-4:45pm MDT"
        const timeMatches = cellText.match(/(\d{1,2}:\d{2}[ap]m\s+\w+)-(\d{1,2}:\d{2}[ap]m\s+\w+)/gi);
        
        if (timeMatches) {
          // Extract date from URL or context
          let eventDate = new Date();
          const dateLinks = cell.querySelectorAll('a[href*="/event/"]');
          if (dateLinks.length > 0) {
            const link = dateLinks[0] as HTMLAnchorElement;
            const dateMatch = link.href.match(/\/event\/\d+\/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
            if (dateMatch) {
              const [, year, month, day] = dateMatch;
              eventDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            }
          }
          
          timeMatches.forEach((timeMatch, timeIndex) => {
            const [, startTimeStr, endTimeStr] = timeMatch.match(/(\d{1,2}:\d{2}[ap]m\s+\w+)-(\d{1,2}:\d{2}[ap]m\s+\w+)/i) || [];
            
            if (startTimeStr && endTimeStr) {
              const startTime = this.parseTimeWithTimezone(startTimeStr, eventDate);
              const endTime = this.parseTimeWithTimezone(endTimeStr, eventDate);
              
              // Try to extract event title from cell text
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
                  
                  // Clean up title - remove leading day numbers like "27All Ages Stick & Puck"
                  let cleanTitle = line;
                  
                  // Remove leading day numbers (1-31 followed by letters)
                  cleanTitle = cleanTitle.replace(/^\d{1,2}([A-Za-z])/, '$1');
                  
                  // Remove other common artifacts
                  cleanTitle = cleanTitle.replace(/^-\s*/, ''); // Remove leading dash
                  cleanTitle = cleanTitle.trim();
                  
                  if (cleanTitle.length > 3) {
                    title = cleanTitle;
                    break;
                  }
                }
              }
              
              events.push({
                id: `ice-ranch-${eventDate.getTime()}-${cellIndex}-${timeIndex}`,
                rinkId: 'ice-ranch',
                title: title,
                startTime: startTime,
                endTime: endTime,
                category: this.categorizeEvent(title),
                description: `Scraped from Ice Ranch calendar`
              });
              
              eventsFound++;
            }
          });
        }
      });
      
      console.log(`🎯 Memorial Day found: ${memorialDayFound}`);
      console.log(`📅 Total events found: ${eventsFound}`);
      
      // Sort events by date
      events.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      
      return events;
      
    } catch (error) {
      console.error('❌ Ice Ranch scraping failed:', error.message);
      throw error;
    }
  }

  async scrapeBigBear(): Promise<RawIceEventData[]> {
    try {
      console.log('🐻 Scraping Big Bear Ice Arena...');
      const url = 'https://bigbearicearena.ezfacility.com/Sessions';
      const html = await this.fetchWithFallback(url);
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      const events: RawIceEventData[] = [];
      
      console.log('🔍 Parsing Big Bear sessions...');
      
      // ezFacility often uses specific classes or data attributes
      // Look for session/event elements
      const sessionElements = doc.querySelectorAll('div, span, td, tr, li');
      console.log(`   Found ${sessionElements.length} potential elements`);
      
      let sessionsFound = 0;
      
      sessionElements.forEach((element, index) => {
        const text = element.textContent || '';
        
        // Skip very short or very long text
        if (text.length < 10 || text.length > 200) return;
        
        // Look for time patterns that indicate sessions
        const timeMatch = text.match(/(\d{1,2}:\d{2})\s*([ap]m)?/i);
        
        if (timeMatch) {
          // Get computed styles to check for background colors (Big Bear's color coding)
          const computedStyle = window.getComputedStyle ? window.getComputedStyle(element) : null;
          const bgColor = computedStyle?.backgroundColor?.toLowerCase() || '';
          const className = element.className?.toLowerCase() || '';
          
          // Determine category by color or text content
          let category: EventCategory = 'Other';
          const textLower = text.toLowerCase();
          
          if (textLower.includes('public') || bgColor.includes('purple') || className.includes('public')) {
            category = 'Public Skate';
          } else if (textLower.includes('stick') || bgColor.includes('green') || className.includes('stick')) {
            category = 'Stick & Puck';
          } else if (textLower.includes('drop') || bgColor.includes('red') || className.includes('drop')) {
            category = 'Drop-In Hockey';
          } else if (textLower.includes('freestyle') || bgColor.includes('pink') || className.includes('freestyle')) {
            category = 'Figure Skating';
          } else if (textLower.includes('party') || bgColor.includes('navy') || className.includes('party')) {
            category = 'Special Event';
          } else if (textLower.includes('hockey') && textLower.includes('party') || bgColor.includes('gold')) {
            category = 'Special Event';
          }
          
          // Clean up the title
          let title = text.trim();
          
          // Remove time from title if it's included
          title = title.replace(/\d{1,2}:\d{2}\s*[ap]m/gi, '').trim();
          
          // Remove common ezFacility artifacts
          title = title.replace(/register/gi, '').trim();
          title = title.replace(/click here/gi, '').trim();
          title = title.replace(/^\W+/, '').trim(); // Remove leading punctuation
          
          // Only proceed if we have a meaningful title
          if (title.length > 3 && title.length < 100) {
            const now = new Date();
            const startTime = this.parseTimeString(timeMatch[0], now);
            const endTime = new Date(startTime.getTime() + (90 * 60 * 1000)); // Default 90 min
            
            events.push({
              id: `big-bear-${Date.now()}-${index}`,
              rinkId: 'big-bear',
              title: title,
              startTime: startTime,
              endTime: endTime,
              category: category,
              description: `Scraped from Big Bear Ice Arena - ${bgColor ? `Color: ${bgColor}` : 'No color info'}`
            });
            
            sessionsFound++;
            
            // Log the first few for debugging
            if (sessionsFound <= 3) {
              console.log(`   Session ${sessionsFound}: "${title}" (${category}) - Color: ${bgColor || 'none'}`);
            }
          }
        }
      });
      
      console.log(`🐻 Big Bear: Found ${sessionsFound} sessions`);
      
      // Sort events by date
      events.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      
      return events;
      
    } catch (error) {
      console.error('❌ Big Bear scraping failed:', error.message);
      // Don't throw - just return empty array so other rinks can still work
      return [];
    }
  }

  private parseTimeString(timeStr: string, baseDate: Date): Date {
    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*([ap]m)?/i);
    if (!timeMatch) return baseDate;
    
    let hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);
    const ampm = timeMatch[3]?.toLowerCase();
    
    // If no am/pm specified, guess based on hour
    if (!ampm) {
      if (hours < 7) hours += 12; // Assume afternoon for early hours
    } else {
      if (ampm === 'pm' && hours !== 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;
    }
    
    const result = new Date(baseDate);
    result.setHours(hours, minutes, 0, 0);
    
    // If the time is in the past, assume it's tomorrow or next week
    if (result < new Date()) {
      result.setDate(result.getDate() + 1);
    }
    
    return result;
  }

  async scrapeSSPRD(facilityId: string): Promise<RawIceEventData[]> {
    console.log(`🏢 SSPRD ${facilityId} scraping skipped for now (focusing on Ice Ranch)`);
    return [];
  }

  async scrapeAllRinks(): Promise<RawIceEventData[]> {
    console.log('🚀 Starting scraping (Ice Ranch + Big Bear)...');
    
    try {
      const results = await Promise.allSettled([
        this.scrapeTheIceRanch(),
        this.scrapeBigBear(),
      ]);
      
      const allEvents: RawIceEventData[] = [];
      
      results.forEach((result, index) => {
        const rinkName = index === 0 ? 'Ice Ranch' : 'Big Bear';
        
        if (result.status === 'fulfilled') {
          allEvents.push(...result.value);
          console.log(`✅ ${rinkName}: ${result.value.length} events`);
        } else {
          console.log(`❌ ${rinkName} failed: ${result.reason.message}`);
        }
      });
      
      console.log(`✅ Scraping complete: ${allEvents.length} events total`);
      return allEvents;
    } catch (error) {
      console.error('❌ Scraping failed:', error.message);
      throw error;
    }
  }

  private parseTimeWithTimezone(timeStr: string, date: Date): Date {
    // Parse "3:15pm MDT" format
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*([ap]m)\s*(\w+)?/i);
    if (!match) return date;
    
    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const ampm = match[3].toLowerCase();
    
    if (ampm === 'pm' && hours !== 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;
    
    const result = new Date(date);
    result.setHours(hours, minutes, 0, 0);
    
    return result;
  }

  private categorizeEvent(title: string): EventCategory {
    const titleLower = title.toLowerCase();
    
    if (titleLower.includes('closed') || titleLower.includes('holiday') || titleLower.includes('memorial')) {
      return 'Special Event';
    }
    if (titleLower.includes('public skate')) return 'Public Skate';
    if (titleLower.includes('stick') && titleLower.includes('puck')) return 'Stick & Puck';
    if (titleLower.includes('drop') || titleLower.includes('pickup')) return 'Drop-In Hockey';
    if (titleLower.includes('learn') || titleLower.includes('lesson')) return 'Learn to Skate';
    if (titleLower.includes('freestyle') || titleLower.includes('figure')) return 'Figure Skating';
    if (titleLower.includes('practice')) return 'Hockey Practice';
    if (titleLower.includes('league') || titleLower.includes('game')) return 'Hockey League';
    if (titleLower.includes('broomball')) return 'Special Event';
    
    return 'Other';
  }
}
