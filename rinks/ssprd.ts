import { RawIceEventData } from '../types';
import { BaseScraper } from './base-scraper';

export class SSPRDScraper extends BaseScraper {
  constructor(private facilityId: string) {
    super();
  }

  get rinkId(): string { 
    return `ssprd-${this.facilityId}`;
  }
  
  get rinkName(): string { 
    return this.facilityId === '249' ? 'SSPRD Family Sports Center' : 'SSPRD Sports Complex';
  }

  async scrape(): Promise<RawIceEventData[]> {
    try {
      console.log(`🏢 Scraping ${this.rinkName}...`);
      const url = `https://ssprd.finnlyconnect.com/schedule/${this.facilityId}`;
      const html = await this.fetchWithFallback(url);
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      const events: RawIceEventData[] = [];
      
      console.log('🔍 Parsing SSPRD schedule...');
      console.log(`   HTML size: ${html.length} characters`);
      
      // Strategy 1: Look for embedded JSON in script tags (more comprehensive)
      let foundJsonEvents = false;
      const scripts = doc.querySelectorAll('script');
      
      console.log(`   Found ${scripts.length} script tags`);
      
      scripts.forEach((script, scriptIndex) => {
        const scriptContent = script.textContent || '';
        
        // Skip very small scripts
        if (scriptContent.length < 50) return;
        
        // Look for various JSON patterns that might contain events
        const eventPatterns = [
          // Standard patterns
          /events[\"']?\s*:\s*(\[.*?\])/g,
          /schedule[\"']?\s*:\s*(\[.*?\])/g,
          /data[\"']?\s*:\s*(\[.*?\])/g,
          /"events":\s*(\[.*?\])/g,
          /"schedule":\s*(\[.*?\])/g,
          // FinnlyConnect specific patterns
          /calendar[\"']?\s*:\s*(\[.*?\])/g,
          /sessions[\"']?\s*:\s*(\[.*?\])/g,
          /bookings[\"']?\s*:\s*(\[.*?\])/g,
          // Look for date-time patterns
          /\[\s*\{[^}]*"date"[^}]*\}[^\]]*\]/g,
          /\[\s*\{[^}]*"time"[^}]*\}[^\]]*\]/g,
          /\[\s*\{[^}]*"start"[^}]*\}[^\]]*\]/g,
          // Look for arrays with object containing calendar data
          /\[[^\]]*\{[^}]*(?:date|time|start|event|title)[^}]*\}[^\]]*\]/g,
        ];
        
        for (const pattern of eventPatterns) {
          let match;
          while ((match = pattern.exec(scriptContent)) !== null) {
            try {
              const jsonStr = match[1];
              const eventsData = JSON.parse(jsonStr);
              
              if (Array.isArray(eventsData) && eventsData.length > 0) {
                console.log(`   📊 Found JSON array in script ${scriptIndex}: ${eventsData.length} items`);
                console.log(`   First item preview:`, eventsData[0]);
                
                eventsData.forEach((event: any, index: number) => {
                  if (this.isValidEvent(event)) {
                    const parsedEvent = this.parseEventFromJson(event, index);
                    if (parsedEvent) {
                      events.push(parsedEvent);
                      foundJsonEvents = true;
                    }
                  }
                });
              }
            } catch (e) {
              // JSON parsing failed, continue
            }
          }
        }
        
        // Also look for calendar initialization or config
        if (scriptContent.includes('calendar') || scriptContent.includes('schedule') || scriptContent.includes('finnly')) {
          console.log(`   📝 Script ${scriptIndex} contains calendar/schedule references (${scriptContent.length} chars)`);
          // Log a sample to see what's in there
          const sample = scriptContent.substring(0, 200).replace(/\s+/g, ' ');
          console.log(`   Sample: ${sample}...`);
        }
      });
      
      // Strategy 2: Look for calendar table elements
      if (!foundJsonEvents) {
        console.log('   📋 No JSON found, parsing HTML calendar elements...');
        
        // Look for calendar-specific selectors
        const calendarSelectors = [
          '.calendar-event', '.event', '.session', '.schedule-item',
          '.fc-event', '.fc-event-title', '.fc-time', // FullCalendar
          '[data-event]', '[data-time]', '[data-date]',
          'tr[data-date]', 'td[data-date]', 'div[data-event]',
          '.calendar tbody tr', '.calendar tbody td',
          'table tr', 'table td', // Generic table rows/cells
        ];
        
        for (const selector of calendarSelectors) {
          try {
            const elements = doc.querySelectorAll(selector);
            if (elements.length > 0) {
              console.log(`   Found ${elements.length} elements with selector: ${selector}`);
              
              elements.forEach((element, index) => {
                const text = element.textContent || '';
                const html = element.innerHTML || '';
                
                // Look for time patterns and meaningful content
                const timeMatch = text.match(/(\d{1,2}:\d{2})\s*([ap]m)?/i);
                const dateMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{4})|(\d{4}-\d{2}-\d{2})/);
                
                if ((timeMatch || dateMatch) && text.length > 10 && text.length < 300) {
                  console.log(`   📅 Potential event in ${selector}[${index}]: "${text.substring(0, 100)}..."`);
                  
                  // Try to parse this as an event
                  const parsedEvent = this.parseEventFromHtml(element, index);
                  if (parsedEvent) {
                    events.push(parsedEvent);
                  }
                }
              });
            }
          } catch (e) {
            // Selector failed, continue
          }
        }
      }
      
      // Strategy 3: Look for any time patterns in the entire document
      if (events.length === 0) {
        console.log('   🔍 No structured events found, searching for time patterns...');
        
        const allText = doc.body.textContent || '';
        const timePattern = /(\d{1,2}:\d{2}\s*[ap]m)/gi;
        const timeMatches = allText.match(timePattern);
        
        if (timeMatches) {
          console.log(`   Found ${timeMatches.length} time patterns in document`);
          console.log(`   Time samples: ${timeMatches.slice(0, 5).join(', ')}`);
          
          // For now, just log this information
          // We could create placeholder events, but better to understand the structure first
        }
        
        // Also check for specific SSPRD content
        const hasPublicSkate = allText.toLowerCase().includes('public skate');
        const hasStickPuck = allText.toLowerCase().includes('stick') && allText.toLowerCase().includes('puck');
        const hasDropIn = allText.toLowerCase().includes('drop') && allText.toLowerCase().includes('hockey');
        
        console.log(`   Content indicators: Public Skate: ${hasPublicSkate}, Stick & Puck: ${hasStickPuck}, Drop-in Hockey: ${hasDropIn}`);
      }
      
      console.log(`🏢 ${this.rinkName}: Found ${events.length} events`);
      
      // Sort events by date
      events.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      
      return events;
      
    } catch (error) {
      console.error(`❌ ${this.rinkName} scraping failed:`, error.message);
      return []; // Return empty array instead of throwing
    }
  }

  private parseEventFromJson(event: any, index: number): RawIceEventData | null {
    try {
      let startTime: Date;
      let title = event.title || event.name || event.summary || 'Ice Time';
      
      // Try different date/time field combinations
      if (event.start) {
        startTime = new Date(event.start);
      } else if (event.startTime) {
        startTime = new Date(event.startTime);
      } else if (event.date && event.time) {
        startTime = new Date(`${event.date} ${event.time}`);
      } else if (event.datetime) {
        startTime = new Date(event.datetime);
      } else {
        return null;
      }
      
      let endTime: Date;
      if (event.end) {
        endTime = new Date(event.end);
      } else if (event.endTime) {
        endTime = new Date(event.endTime);
      } else {
        // Default to 90 minutes
        endTime = new Date(startTime.getTime() + (90 * 60 * 1000));
      }
      
      // Clean up title
      title = this.cleanTitle(title);
      
      return {
        id: `${this.rinkId}-json-${Date.now()}-${index}`,
        rinkId: this.rinkId,
        title: title,
        startTime: startTime,
        endTime: endTime,
        category: this.categorizeEvent(title),
        description: `Scraped from ${this.rinkName} schedule`
      };
    } catch (e) {
      return null;
    }
  }

  private parseEventFromHtml(element: Element, index: number): RawIceEventData | null {
    try {
      const text = element.textContent || '';
      const timeMatch = text.match(/(\d{1,2}:\d{2})\s*([ap]m)?/i);
      
      if (!timeMatch) return null;
      
      // Clean up the title
      let title = text.trim();
      title = title.replace(/\d{1,2}:\d{2}[ap]m/gi, '').trim();
      title = this.cleanTitle(title);
      
      if (title.length < 3) return null;
      
      const now = new Date();
      const startTime = this.parseTimeString(timeMatch[0], now);
      const endTime = new Date(startTime.getTime() + (90 * 60 * 1000));
      
      return {
        id: `${this.rinkId}-html-${Date.now()}-${index}`,
        rinkId: this.rinkId,
        title: title,
        startTime: startTime,
        endTime: endTime,
        category: this.categorizeEvent(title),
        description: `Scraped from ${this.rinkName} schedule`
      };
    } catch (e) {
      return null;
    }
  }

  private isValidEvent(event: any): boolean {
    if (!event || typeof event !== 'object') return false;
    
    // Must have some kind of title/name
    const hasTitle = (event.title || event.name || event.summary) && 
                     typeof (event.title || event.name || event.summary) === 'string';
    
    // Must have some kind of date/time
    const hasDateTime = event.start || event.startTime || event.date || event.datetime || 
                        event.time || (event.date && event.time);
    
    // Skip obviously invalid entries
    const title = event.title || event.name || event.summary || '';
    const isValidTitle = title.length > 2 && title.length < 200 && 
                        !title.toLowerCase().includes('undefined') &&
                        !title.toLowerCase().includes('null');
    
    return hasTitle && hasDateTime && isValidTitle;
  }
}

// Factory functions for easier use
export const createFamilySportsCenterScraper = () => new SSPRDScraper('249');
export const createSportsComplexScraper = () => new SSPRDScraper('250');
