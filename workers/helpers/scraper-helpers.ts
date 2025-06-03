// workers/helpers/scraper-helpers.ts - Common functions for all scrapers

export interface RawIceEventData {
  id: string;
  rinkId: string;
  title: string;
  startTime: string;
  endTime: string;
  description?: string;
  category: string;
  isFeatured?: boolean;
  eventUrl?: string;
}

export interface FacilityMetadata {
  facilityId: string;
  facilityName: string;
  displayName: string;
  lastAttempt: string;
  status: 'success' | 'error';
  eventCount: number;
  errorMessage?: string;
  sourceUrl: string;
  rinks: Array<{
    rinkId: string;
    rinkName: string;
  }>;
  lastSuccessfulScrape?: string;
}

export interface RinkConfig {
  facilityName: string;
  displayName: string;
  sourceUrl: string;
  rinkName: string;
}

export class ScraperHelpers {
  
  /**
   * Get CORS headers for responses
   */
  static corsHeaders(): Record<string, string> {
    return {
      'Content-Type': 'text/plain',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
  }

  /**
   * Create a JSON response with CORS headers
   */
  static jsonResponse(data: any, status: number = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }

  /**
   * Get random delay in milliseconds within the specified minutes
   */
  static getRandomDelay(maxMinutes: number): number {
    return Math.floor(Math.random() * maxMinutes * 60 * 1000);
  }

  /**
   * Get the next scheduled time for scraping with random splay
   */
  static getNextScheduledTime(splayMinutes: number = 360): Date {
    const now = new Date();
    const delayMs = ScraperHelpers.getRandomDelay(splayMinutes);
    const nextTime = new Date(now.getTime() + delayMs);
    
    console.log(`📅 Next scheduled time: ${nextTime.toISOString()} (splay: ${Math.floor(delayMs/60000)} minutes)`);
    
    return nextTime;
  }

  /**
   * Write events and metadata to KV storage
   */
  static async writeToKV(
    kvNamespace: KVNamespace,
    rinkId: string,
    events: RawIceEventData[],
    config: RinkConfig
  ): Promise<void> {
    // Store events data
    await kvNamespace.put(`events:${rinkId}`, JSON.stringify(events));
    
    // Store metadata
    const metadata: FacilityMetadata = {
      facilityId: rinkId,
      facilityName: config.facilityName,
      displayName: config.displayName,
      lastAttempt: new Date().toISOString(),
      status: 'success',
      eventCount: events.length,
      sourceUrl: config.sourceUrl,
      rinks: [{ rinkId, rinkName: config.rinkName }],
      lastSuccessfulScrape: new Date().toISOString()
    };
    
    await kvNamespace.put(`metadata:${rinkId}`, JSON.stringify(metadata));
    
    console.log(`💾 Stored ${events.length} events and metadata for ${rinkId}`);
  }

  /**
   * Write error metadata to KV storage when scraping fails
   */
  static async writeErrorMetadata(
    kvNamespace: KVNamespace,
    rinkId: string,
    error: any,
    config: RinkConfig
  ): Promise<void> {
    const errorMetadata: FacilityMetadata = {
      facilityId: rinkId,
      facilityName: config.facilityName,
      displayName: config.displayName,
      lastAttempt: new Date().toISOString(),
      status: 'error',
      eventCount: 0,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      sourceUrl: config.sourceUrl,
      rinks: [{ rinkId, rinkName: config.rinkName }]
    };
    
    await kvNamespace.put(`metadata:${rinkId}`, JSON.stringify(errorMetadata));
    console.log(`💾 Stored error metadata for ${rinkId}: ${errorMetadata.errorMessage}`);
  }

  /**
   * Parse time strings in various formats to Date objects
   * Handles timezone conversion from Mountain Time to UTC
   */
  static parseMountainTime(timeStr: string, baseDate?: Date): Date {
    // If no base date provided, use current date
    if (!baseDate) {
      baseDate = new Date();
    }

    // Try parsing as full datetime first
    let date = new Date(timeStr);
    if (!isNaN(date.getTime())) {
      // Check if timezone info is present
      const hasTimezone = /[+-]\d{2}:?\d{2}|Z|UTC|GMT|[A-Z]{3,4}T?$/i.test(timeStr);
      if (!hasTimezone) {
        // Assume Mountain Time and convert to UTC (add 6 hours for MDT, 7 for MST)
        // For simplicity, always add 6 hours (MDT)
        date.setTime(date.getTime() + (6 * 60 * 60 * 1000));
      }
      return date;
    }

    // Try parsing as time only (e.g., "2:30 PM")
    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*([AP])\.?M\.?/i);
    if (timeMatch && baseDate) {
      let hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);
      const ampm = timeMatch[3].toLowerCase();
      
      if (ampm === 'p' && hours !== 12) hours += 12;
      if (ampm === 'a' && hours === 12) hours = 0;
      
      const result = new Date(baseDate);
      result.setUTCHours(hours, minutes, 0, 0);
      // Convert from Mountain Time to UTC
      result.setTime(result.getTime() + (6 * 60 * 60 * 1000));
      return result;
    }

    // Fallback: return baseDate or current time
    return baseDate || new Date();
  }

  /**
   * Clean and normalize event titles
   */
  static cleanTitle(rawTitle: string): string {
    if (!rawTitle) return 'Untitled Event';
    
    let cleanTitle = rawTitle.trim();
    
    // Remove leading numbers followed by letters (e.g., "1A" -> "A")
    cleanTitle = cleanTitle.replace(/^\d{1,2}([A-Za-z])/, '$1');
    
    // Remove leading dashes
    cleanTitle = cleanTitle.replace(/^-\s*/, '');
    
    // Remove registration/promotional text
    cleanTitle = cleanTitle.replace(/register/gi, '');
    cleanTitle = cleanTitle.replace(/click here/gi, '');
    
    // Remove leading non-word characters
    cleanTitle = cleanTitle.replace(/^\W+/, '');
    
    return cleanTitle.trim() || 'Ice Event';
  }

  /**
   * Categorize events based on title keywords
   */
  static categorizeEvent(title: string): string {
    if (!title) return 'Other';
    
    const titleLower = title.toLowerCase().trim();
    
    // Special events
    if (titleLower.includes('closed') || titleLower.includes('holiday') || titleLower.includes('memorial')) {
      return 'Special Event';
    }
    
    // Public skating
    if (titleLower.includes('public skate') || titleLower.includes('open skate')) {
      return 'Public Skate';
    }
    
    // Stick & Puck
    if (titleLower.includes('stick') && titleLower.includes('puck')) {
      return 'Stick & Puck';
    }
    if (titleLower.includes('take a shot')) {
      return 'Stick & Puck';
    }
    
    // Drop-in hockey
    if (titleLower.includes('drop') || titleLower.includes('pickup')) {
      return 'Drop-In Hockey';
    }
    
    // Learn to skate
    if (titleLower.includes('learn') || titleLower.includes('lesson') || titleLower.includes('lts')) {
      return 'Learn to Skate';
    }
    
    // Figure skating
    if (titleLower.includes('freestyle') || titleLower.includes('figure')) {
      return 'Figure Skating';
    }
    
    // Hockey practice
    if (titleLower.includes('practice') || titleLower.includes('training')) {
      return 'Hockey Practice';
    }
    
    // Hockey league/games
    if (titleLower.includes('league') || titleLower.includes('game')) {
      return 'Hockey League';
    }
    
    // Other special events
    if (titleLower.includes('broomball') || titleLower.includes('party')) {
      return 'Special Event';
    }
    
    return 'Other';
  }

  /**
   * Generate a user agent string for scraping
   */
  static getUserAgent(): string {
    // return 'Mozilla/5.0 (compatible; DenverRinkScheduler/1.0)';
    return 'Mozilla/5.0 (Macintosh; Intel Mac OS X 9_3_4; en-US) AppleWebKit/533.23 (KHTML, like Gecko) Chrome/49.0.1461.334 Safari/602';
  }

  /**
   * Filter events to next 30 days only
   */
  static filterEventsToNext30Days(events: RawIceEventData[]): RawIceEventData[] {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
    
    return events.filter(event => {
      const startTime = new Date(event.startTime);
      return startTime >= now && startTime <= thirtyDaysFromNow;
    });
  }

  /**
   * Sort events by start time
   */
  static sortEventsByTime(events: RawIceEventData[]): RawIceEventData[] {
    return events.sort((a, b) => 
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
  }
}

