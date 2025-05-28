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

  // Parse SSPRD datetime string and convert from Mountain Time to UTC
  private parseSSPRDDateTime(dateTimeStr: string): Date {
    // SSPRD API returns datetime strings that might be in Mountain Time
    // We need to handle various possible formats and convert to UTC
    
    const date = new Date(dateTimeStr);
    
    // Check if the date parsed correctly
    if (isNaN(date.getTime())) {
      console.warn(`   ⚠️ Invalid date format: ${dateTimeStr}`);
      return new Date(); // Return current date as fallback
    }
    
    // If the dateTimeStr doesn't include timezone info, JavaScript treats it as local time
    // But the SSPRD servers are in Mountain Time, so we need to adjust
    
    // Check if the date string includes timezone info
    const hasTimezone = /[+-]\d{2}:?\d{2}|Z|UTC|GMT|[A-Z]{3,4}T?$/i.test(dateTimeStr);
    
    if (!hasTimezone) {
      // No timezone info, assume it's Mountain Time and convert to UTC
      // Mountain Daylight Time (MDT) is UTC-6, Mountain Standard Time (MST) is UTC-7
      // For current events, assume MDT (UTC-6)
      
      // Get the time components as if they were in Mountain Time
      const year = date.getFullYear();
      const month = date.getMonth();
      const day = date.getDate();
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const seconds = date.getSeconds();
      const milliseconds = date.getMilliseconds();
      
      // Create a UTC date with these components, then add 6 hours
      const utcDate = new Date(Date.UTC(year, month, day, hours, minutes, seconds, milliseconds));
      utcDate.setTime(utcDate.getTime() + (6 * 60 * 60 * 1000)); // Add 6 hours for MDT->UTC
      
      console.log(`   🕐 SSPRD timezone conversion: ${dateTimeStr} -> ${utcDate.toISOString()}`);
      console.log(`   📍 Mountain Time check: ${utcDate.toLocaleString('en-US', {timeZone: 'America/Denver'})}`);
      
      return utcDate;
    } else {
      // Timezone info included, use as-is
      console.log(`   ℹ️ SSPRD date with timezone: ${dateTimeStr} -> ${date.toISOString()}`);
      return date;
    }
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
                    // Use the new timezone-aware date parsing
                    const startTime = this.parseSSPRDDateTime(item.EventStartTime);
                    const endTime = this.parseSSPRDDateTime(item.EventEndTime);

                    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
                        console.warn(`   ⚠️ Invalid parsed dates for event: ${title}`);
                        return;
                    }
                    
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
