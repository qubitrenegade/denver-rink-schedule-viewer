import { RawIceEventData, EventCategory } from '../types';

export abstract class BaseScraper {
  protected proxyUrls = [
    'https://api.allorigins.win/get?url=',
    'https://api.codetabs.com/v1/proxy?quest=',
  ];

  abstract get rinkId(): string;
  abstract get rinkName(): string;
  abstract scrape(): Promise<RawIceEventData[]>;

  protected async fetchWithFallback(url: string): Promise<string> {
    const errors = [];
    
    for (const proxyUrl of this.proxyUrls) {
      try {
        console.log(`🔄 [${this.rinkName}] Trying proxy: ${proxyUrl}`);
        
        let fetchUrl: string;
        
        if (proxyUrl.includes('allorigins')) {
          fetchUrl = `${proxyUrl}${encodeURIComponent(url)}`;
        } else if (proxyUrl.includes('codetabs')) {
          fetchUrl = `${proxyUrl}${encodeURIComponent(url)}`;
        } else {
          fetchUrl = `${proxyUrl}${url}`;
        }
        
        console.log(`   Full URL: ${fetchUrl}`);
        
        const fetchStart = Date.now();
        const response = await fetch(fetchUrl, {
          method: 'GET',
          mode: 'cors',
          credentials: 'omit',
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
