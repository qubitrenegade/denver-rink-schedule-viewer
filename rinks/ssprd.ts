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
      
      // Strategy 1: Look for embedded JSON data in script tags
      let foundJsonEvents = false;
      const scripts = doc.querySelectorAll('script');
      
      scripts.forEach((script, scriptIndex) => {
        const scriptContent = script.textContent || '';
        
        // Look for various JSON patterns that might contain events
        const eventPatterns = [
          /events[\"']?\s*:\s*(\[.*?\])/,
          /schedule[\"']?\s*:\s*(\[.*?\])/,
          /data[\"']?\s*:\s*(\[.*?\])/,
          /"events":\s*(\[.*?\])/,
          /"schedule":\s*(\[.*?\])/,
        ];
        
        for (const pattern of eventPatterns) {
          const match = scriptContent.match(pattern);
          if (match) {
            try {
              const eventsData = JSON.parse(match[1]);
              console.log(`   📊 Found JSON events in script ${scriptIndex}: ${eventsData.length} items`);
              
              eventsData.forEach((event: any, index: number) => {
                if (this.isValidEvent(event)) {
                  const startTime = new Date(event.start || event.startTime || event.date);
                  const endTime = new Date(event.end || event.endTime || startTime.getTime() + (90 * 60 * 1000));
                  
                  // Clean up title
                  let title = event.title || event.name || 'Ice Time';
                  title = this.cleanTitle(title);
                  
                  events.push({
                    id: `${this.rinkId}-json-${Date.now()}-${index}`,
                    rinkId: this.rinkId,
                    title: title,
                    startTime: startTime,
                    endTime: endTime,
                    category: this.categorizeEvent(title),
                    description: `Scraped from ${this.rinkName} schedule`,
                    // SSPRD doesn't have individual event URLs
                  });
                  
                  foundJsonEvents = true;
                }
              });
            } catch (e) {
              // JSON parsing failed, continue
            }
          }
        }
      });
      
      // Strategy 2: If no JSON found, parse HTML elements
      if (!foundJsonEvents) {
        console.log('   📋 No JSON found, parsing HTML elements...');
        
        const eventElements = doc.querySelectorAll([
          '.event', '.session', '.schedule-item',
          'tr', 'li', 'div[class*="event"]', 
          'div[class*="session"]', 'div[class*="schedule"]'
        ].join(', '));
        
        console.log(`   Found ${eventElements.length} potential event elements`);
        
        eventElements.forEach((element, index) => {
          const text = element.textContent || '';
          
          // Look for time patterns and meaningful content
          const timeMatch = text.match(/(\d{1,2}:\d{2}[ap]m)/i);
          
          if (timeMatch && text.length > 15 && text.length < 200) {
            // Clean up the title
            let title = text.trim();
            title = title.replace(/\d{1,2}:\d{2}[ap]m/gi, '').trim();
            title = this.cleanTitle(title);
            
            if (title.length > 3) {
              const now = new Date();
              const startTime = this.parseTimeString(timeMatch[1], now);
              const endTime = new Date(startTime.getTime() + (90 * 60 * 1000));
              
              events.push({
                id: `${this.rinkId}-html-${Date.now()}-${index}`,
                rinkId: this.rinkId,
                title: title,
                startTime: startTime,
                endTime: endTime,
                category: this.categorizeEvent(title),
                description: `Scraped from ${this.rinkName} schedule`
              });
            }
          }
        });
      }
      
      console.log(`🏢 ${this.rinkName}: Found ${events.length} events`);
      
      // Sort events by date
      events.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      
      return events;
      
    } catch (error) {
      console.error(`❌ ${this.rinkName} scraping failed:`, error.message);
      return []; // Return empty array instead of throwing to allow other rinks to work
    }
  }

  private isValidEvent(event: any): boolean {
    return event && 
           (event.title || event.name) && 
           (event.start || event.startTime || event.date) &&
           typeof (event.title || event.name) === 'string';
  }
}

// Factory functions for easier use
export const createFamilySportsCenterScraper = () => new SSPRDScraper('249');
export const createSportsComplexScraper = () => new SSPRDScraper('250');

