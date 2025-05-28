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

  // These identify the scraper instance itself (for logging, etc.), not the rinks it scrapes data FOR.
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
        if (onlineScheduleListFound) return; // Process only the first match
        const scriptContent = script.textContent || '';
        const match = scriptContent.match(/_onlineScheduleList\s*=\s*(\[.*?\]);/);
        
        if (match && match[1]) {
          console.log(`   📊 Found _onlineScheduleList on ${this.rinkName}`);
          onlineScheduleListFound = true;
          try {
            const scheduleData = JSON.parse(match[1]);
            if (Array.isArray(scheduleData)) {
              console.log(`   📅 Processing ${scheduleData.length} events from schedule data`);
              
              scheduleData.forEach((item: any, index: number) => {
                const specificRinkId = facilityIdToRinkIdMap[item.FacilityId];
                if (!specificRinkId) {
                  // console.warn(`   ⚠️ Unknown FacilityId ${item.FacilityId} for item on ${this.rinkName}:`, item.FacilityName);
                  return; // Skip if we can't map it to one of our known rinks
                }

                const title = item.AccountName ? String(item.AccountName).trim() : 'Unnamed Event';
                // FinnlyConnect uses "title" in the event template for start/end time string, not the event's actual title.
                // We use AccountName from _onlineScheduleList as the title.

                let category = this.categorizeEvent(item.EventTypeName || title);
                if (category === 'Other' && item.EventTypeName !== title) {
                    category = this.categorizeEvent(title); // Fallback to title if EventTypeName was generic
                }

                try {
                    // Parse the date strings - these should be in the facility's local timezone
                    // SSPRD facilities are in Mountain Time
                    
                    let startTime: Date;
                    let endTime: Date;
                    
                    console.log(`🕐 Parsing SSPRD event times for "${title}"`);
                    console.log(`   Raw start: ${item.EventStartTime}`);
                    console.log(`   Raw end: ${item.EventEndTime}`);
                    
                    // The EventStartTime and EventEndTime from SSPRD are likely in Mountain Time
                    // but JavaScript Date constructor treats them as local time or UTC
                    if (item.EventStartTime) {
                      const rawStart = new Date(item.EventStartTime);
                      const rawEnd = new Date(item.EventEndTime);
                      
                      // Check if these dates look reasonable (not way off)
                      const now = new Date();
                      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
                      
                      if (rawStart >= now && rawStart <= thirtyDaysFromNow) {
                        // The dates seem reasonable, but we need to ensure they're in Mountain Time
                        // If they're being parsed as UTC but should be Mountain Time, adjust them
                        
                        // Get the hour from the original date
                        const startHour = rawStart.getUTCHours();
                        const startMinutes = rawStart.getUTCMinutes();
                        const endHour = rawEnd.getUTCHours();
                        const endMinutes = rawEnd.getUTCMinutes();
                        
                        // Create Mountain Time dates using our helper method
                        startTime = this.createMountainTimeDate(
                          rawStart.getUTCFullYear(),
                          rawStart.getUTCMonth() + 1,
                          rawStart.getUTCDate(),
                          startHour,
                          startMinutes
                        );
                        
                        endTime = this.createMountainTimeDate(
                          rawEnd.getUTCFullYear(),
                          rawEnd.getUTCMonth() + 1,
                          rawEnd.getUTCDate(),
                          endHour,
                          endMinutes
                        );
                        
                      } else {
                        // The parsed dates don't look right, skip this event
                        console.warn(`   ⚠️ Skipping event with invalid dates: ${item.EventStartTime} to ${item.EventEndTime}`);
                        return;
                      }
                    } else {
                      console.warn(`   ⚠️ No EventStartTime for event: ${title}`);
                      return;
                    }

                    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
                        console.warn(`   ⚠️ Invalid date after parsing for event: ${title}`, {
                          originalStart: item.EventStartTime,
                          originalEnd: item.EventEndTime,
                          parsedStart: startTime,
                          parsedEnd: endTime
                        });
                        return;
                    }
                    
                    console.log(`   ✅ Parsed as Mountain Time: ${startTime.toString()} to ${endTime.toString()}`);
                    
                    // Check if the event is "Closed" - we can filter this at a higher level if needed
                    // but good to note it here if it's explicit.
                    const isClosed = item.Closed === true || title.toLowerCase().includes("closed");

                    events.push({
                        id: `${specificRinkId}-${item.EventId || Date.now() + index}`, // Use EventId if available
                        rinkId: specificRinkId,
                        title: isClosed && !title.toLowerCase().includes("closed") ? `Closed: ${title}` : title,
                        startTime,
                        endTime,
                        category,
                        description: item.Description ? String(item.Description).trim() : undefined,
                        isFeatured: item.isFeatured || false, // Assuming isFeatured might exist
                    });
                } catch (dateError) {
                    console.warn(`   ⚠️ Error parsing date for event on ${this.rinkName}:`, {
                      event: item,
                      error: dateError
                    });
                }
              });
            }
          } catch (e) {
            console.error(`   ❌ Error parsing _onlineScheduleList JSON from ${this.rinkName}:`, e);
          }
        }
      });

      if (!onlineScheduleListFound) {
        console.log(`   📋 _onlineScheduleList not found on ${this.rinkName}. No events parsed from this source.`);
      }
      
      console.log(`🏢 ${this.rinkName} (specific rinks): Found ${events.length} events`);
      
      // Debug: Show sample parsed times
      if (events.length > 0) {
        console.log('🔍 Sample SSPRD event times:');
        events.slice(0, 3).forEach((event, i) => {
          console.log(`   ${i + 1}. "${event.title}" - ${event.startTime.toString()}`);
          console.log(`      ISO: ${event.startTime.toISOString()}`);
        });
      }
      
      events.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      return events;
      
    } catch (error) {
      console.error(`❌ ${this.rinkName} scraping failed:`, error);
      return []; 
    }
  }
}

// Factory functions for easier use
export const createSSPRD249Scraper = () => new SSPRDScraper('249', 'https://ssprd.finnlyconnect.com/schedule/249');
export const createSSPRD250Scraper = () => new SSPRDScraper('250', 'https://ssprd.finnlyconnect.com/schedule/250');
