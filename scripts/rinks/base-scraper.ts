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

  protected parseTimeWithTimezone(timeStr: string, date: Date): Date {
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
    
    const result = new Date(baseDate);
    result.setHours(hours, minutes, 0, 0);
    
    if (result < new Date()) {
      result.setDate(result.getDate() + 1);
    }
    
    return result;
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
