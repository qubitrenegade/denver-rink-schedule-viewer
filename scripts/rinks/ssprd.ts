import { RawIceEventData, EventCategory } from '../../src/types.js';
import { BaseScraper } from './base-scraper.js';
import { JSDOM } from 'jsdom';

const facilityIdToRinkIdMap: Record<number, string> = {
  1904: 'fsc-avalanche',        // FSC Avalanche Rink
  1905: 'fsc-fixit',            // FSC Fix-it 24/7 Rink
  1906: 'sssc-rink1',           // SSSC Rink 1
  1907: 'sssc-rink2',           // SSSC Rink 2
  1908: 'sssc-rink3',           // SSSC Rink 3
};

export class SSPRDScraper extends BaseScraper {
  constructor(private schedulePageId: string, private schedulePageUrl: string) {
    super();
  }

  get rinkId(): string { 
    return `ssprd-schedule-${this.schedulePageId}`;
  }
  
  get rinkName(): string { 
    return `SSPRD Schedule Page ${this.schedulePageId}`;
  }

  async scrape(): Promise<RawIceEventData[]> {
    try {
      console.log(`🏢 Scraping ${this.rinkName} from ${this.schedulePageUrl}...`);
      const html = await this.fetchWithFallback(this.schedulePageUrl);
      
      const dom = new JSDOM(html);
      const doc = dom.window.document;
      
      const events: RawIceEventData[] = [];
      
      console.log(`🔍 Parsing ${this.rinkName} content...`);
      
      const scripts = doc.querySelectorAll('script');
      let onlineScheduleListFound = false;
      
      scripts.forEach((script) => {
        if (onlineScheduleListFound) return;
        const scriptContent = script.textContent || '';
        const match = scriptContent.match(/_onlineScheduleList\s*=\s*(\[.*?\]);/);
        
        if (match && match[1]) {
          console.log(`   📊 Found _onlineScheduleList on ${this.rinkName}`);
          onlineScheduleListFound = true;
          try {
            const scheduleData = JSON.parse(match[1]);
            if (Array.isArray(scheduleData)) {
              scheduleData.forEach((item: any, index: number) => {
                const specificRinkId = facilityIdToRinkIdMap[item.FacilityId];
                if (!specificRinkId) {
                  return; // Skip unknown facilities
                }

                const title = item.AccountName ? String(item.AccountName).trim() : 'Unnamed Event';
                
                let category = this.categorizeEvent(item.EventTypeName || title);
                if (category === 'Other' && item.EventTypeName !== title) {
                    category = this.categorizeEvent(title);
                }

                try {
                    // Keep the original, working date parsing logic
                    const startTime = new Date(item.EventStartTime);
                    const endTime = new Date(item.EventEndTime);

                    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
                        console.warn(`   ⚠️ Invalid date for event: ${title}`);
                        return;
                    }
                    
                    // Debug logging to see what we're getting
                    console.log(`🕐 SSPRD event "${title}": ${item.EventStartTime} -> ${startTime.toString()}`);
                    
                    const isClosed = item.Closed === true || title.toLowerCase().includes("closed");

                    events.push({
                        id: `${specificRinkId}-${item.EventId || Date.now() + index}`,
                        rinkId: specificRinkId,
                        title: isClosed && !title.toLowerCase().includes("closed") ? `Closed: ${title}` : title,
                        startTime,
                        endTime,
                        category,
                        description: item.Description ? String(item.Description).trim() : undefined,
                        isFeatured: item.isFeatured || false,
                    });
                } catch (dateError) {
                    console.warn(`   ⚠️ Error parsing date for event: ${title}`, dateError);
                }
              });
            }
          } catch (e) {
            console.error(`   ❌ Error parsing _onlineScheduleList JSON from ${this.rinkName}:`, e);
          }
        }
      });

      if (!onlineScheduleListFound) {
        console.log(`   📋 _onlineScheduleList not found on ${this.rinkName}`);
      }
      
      console.log(`🏢 ${this.rinkName}: Found ${events.length} events`);
      events.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      return events;
      
    } catch (error) {
      console.error(`❌ ${this.rinkName} scraping failed:`, error);
      return []; 
    }
  }
}

export const createSSPRD249Scraper = () => new SSPRDScraper('249', 'https://ssprd.finnlyconnect.com/schedule/249');
export const createSSPRD250Scraper = () => new SSPRDScraper('250', 'https://ssprd.finnlyconnect.com/schedule/250');
