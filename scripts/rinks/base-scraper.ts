import { RawIceEventData, EventCategory } from '../../src/types.js';
import fetch from 'node-fetch';

export abstract class BaseScraper {
  abstract get rinkId(): string;
  abstract get rinkName(): string;
  abstract scrape(): Promise<RawIceEventData[]>;

  protected async fetchWithFallback(url: string): Promise<string> {
    console.log(`🔄 [${this.rinkName}] Fetching directly: ${url}`);
    
    try {
      const fetchStart = Date.now();
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        }
      });
      
      const fetchTime = Date.now() - fetchStart;
      console.log(`   📡 Response: ${response.status} after ${fetchTime}ms`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const html = await response.text();
      console.log(`   ✅ SUCCESS! Got ${html.length} chars of content`);
      return html;
      
    } catch (error) {
      console.error(`   ❌ Failed to fetch ${url}:`, error.message);
      throw error;
    }
  }

  /**
   * Create a Date object in Mountain Time from date and time components
   * This ensures the date is correctly interpreted as Mountain Time, not UTC
   */
  protected createMountainTimeDate(year: number, month: number, day: number, hours: number, minutes: number = 0): Date {
    // Create date using local constructor, then adjust for Mountain Time
    // Mountain Time is UTC-7 (MST) or UTC-6 (MDT)
    // In late May, we're in MDT (UTC-6)
    
    // Create the date as if it's in Mountain Time
    const localDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
    
    // Get the timezone offset difference between local system and Mountain Time
    // Mountain Daylight Time (May) is UTC-6 = 360 minutes
    const mountainOffset = 360; // 6 hours * 60 minutes
    const systemOffset = localDate.getTimezoneOffset();
    
    // If we're not running in Mountain Time, adjust the date
    if (systemOffset !== mountainOffset) {
      const offsetDifference = systemOffset - mountainOffset;
      return new Date(localDate.getTime() + offsetDifference * 60 * 1000);
    }
    
    return localDate;
  }

  /**
   * Parse time with explicit Mountain Time handling
   */
  protected parseTimeWithTimezone(timeStr: string, date: Date): Date {
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*([ap]m)\s*(\w+)?/i);
    if (!match) return date;
    
    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const ampm = match[3].toLowerCase();
    
    if (ampm === 'pm' && hours !== 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;
    
    // Use the Mountain Time date creation method
    const year = date.getFullYear();
    const month = date.getMonth() + 1;  // getMonth() is 0-based
    const day = date.getDate();
    
    return this.createMountainTimeDate(year, month, day, hours, minutes);
  }

  /**
   * Parse time string with Mountain Time handling
   */
  protected parseTimeString(timeStr: string, baseDate: Date): Date {
    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*([ap]m)?/i);
    if (!timeMatch) return baseDate;
    
    let hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);
    const ampm = timeMatch[3]?.toLowerCase();
    
    if (!ampm) {
      if (hours < 7) hours += 12;
    } else {
      if (ampm === 'pm' && hours !== 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;
    }
    
    // Create Mountain Time date
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth() + 1;
    const day = baseDate.getDate();
    
    const result = this.createMountainTimeDate(year, month, day, hours, minutes);
    
    // If the result is in the past, add a day
    if (result < new Date()) {
      result.setDate(result.getDate() + 1);
    }
    
    return result;
  }

  /**
   * Parse a date string (YYYY-MM-DD) and time string into Mountain Time
   */
  protected parseDateTimeInMountainTime(dateStr: string, timeStr: string): Date {
    const [year, month, day] = dateStr.split('-').map(Number);
    
    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*([ap]m)?/i);
    if (!timeMatch) {
      // Default to noon if no time can be parsed
      return this.createMountainTimeDate(year, month, day, 12, 0);
    }
    
    let hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);
    const ampm = timeMatch[3]?.toLowerCase();
    
    if (ampm === 'pm' && hours !== 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;
    
    return this.createMountainTimeDate(year, month, day, hours, minutes);
  }

  protected categorizeEvent(title: string): EventCategory {
    const titleLower = title.toLowerCase();
    
    if (titleLower.includes('closed') || titleLower.includes('holiday') || titleLower.includes('memorial')) {
      return 'Special Event';
    }
    if (titleLower.includes('public skate') || titleLower.includes('open skate')) return 'Public Skate';
    if (titleLower.includes('stick') && titleLower.includes('puck')) return 'Stick & Puck';
    if (titleLower.includes('drop') || titleLower.includes('pickup') || titleLower.includes('take a shot')) return 'Drop-In Hockey';
    if (titleLower.includes('learn') || titleLower.includes('lesson') || titleLower.includes('lts')) return 'Learn to Skate';
    if (titleLower.includes('freestyle') || titleLower.includes('figure')) return 'Figure Skating';
    if (titleLower.includes('practice') || titleLower.includes('training')) return 'Hockey Practice';
    if (titleLower.includes('league') || titleLower.includes('game')) return 'Hockey League';
    if (titleLower.includes('broomball') || titleLower.includes('special')) return 'Special Event';
    
    return 'Other';
  }

  protected cleanTitle(rawTitle: string): string {
    let cleanTitle = rawTitle.trim();
    
    // Remove leading day numbers like "27All Ages Stick & Puck"
    cleanTitle = cleanTitle.replace(/^\d{1,2}([A-Za-z])/, '$1');
    
    // Remove other common artifacts
    cleanTitle = cleanTitle.replace(/^-\s*/, '');
    cleanTitle = cleanTitle.replace(/register/gi, '');
    cleanTitle = cleanTitle.replace(/click here/gi, '');
    cleanTitle = cleanTitle.replace(/^\W+/, '');
    
    return cleanTitle.trim();
  }
}
