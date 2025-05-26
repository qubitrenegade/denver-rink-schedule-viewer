import { RawIceEventData, EventCategory } from './types';

export class RealRinkScraper {
  private proxyUrls = [
    'https://api.allorigins.win/get?url=', // Working ✅
    'https://api.codetabs.com/v1/proxy?quest=', // Working ✅  
    // Note: corsproxy.io seems to be having 500 errors
  ];

  private async fetchWithFallback(url: string): Promise<string> {
    const errors = [];
    
    for (const proxyUrl of this.proxyUrls) {
      try {
        console.log(`🔄 Trying proxy: ${proxyUrl}`);
        
        let fetchUrl: string;
        let response: Response;
        
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
        response = await fetch(fetchUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          mode: 'cors',
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
                    !line.includes('Tag(s):')) {
                  title = line;
                  break;
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

  // Simplified versions for testing
  async scrapeBigBear(): Promise<RawIceEventData[]> {
    console.log('🐻 Big Bear scraping skipped for now (focusing on Ice Ranch)');
    return [];
  }

  async scrapeSSPRD(facilityId: string): Promise<RawIceEventData[]> {
    console.log(`🏢 SSPRD ${facilityId} scraping skipped for now (focusing on Ice Ranch)`);
    return [];
  }

  async scrapeAllRinks(): Promise<RawIceEventData[]> {
    console.log('🚀 Starting scraping (Ice Ranch only for testing)...');
    
    try {
      const iceRanchEvents = await this.scrapeTheIceRanch();
      console.log(`✅ Scraping complete: ${iceRanchEvents.length} events total`);
      return iceRanchEvents;
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