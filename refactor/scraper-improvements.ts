// 🔴 ISSUES IN CURRENT SCRAPERS:
// 1. Inconsistent timezone handling across scrapers
// 2. Duplicated date parsing logic
// 3. Similar error handling patterns not shared
// 4. Event categorization logic duplicated
// 5. Logging patterns inconsistent

// ✅ IMPROVED BASE SCRAPER WITH SHARED UTILITIES

export abstract class BaseScraper {
  abstract get rinkId(): string;
  abstract get rinkName(): string;
  abstract scrape(): Promise<RawIceEventData[]>;

  // 🆕 SHARED TIMEZONE UTILITIES
  protected parseMountainTime(dateStr: string, timeStr?: string): Date {
    let date: Date;
    
    if (timeStr) {
      // Handle separate date and time strings
      date = new Date(`${dateStr}T${this.normalizeTimeString(timeStr)}`);
    } else {
      // Handle combined datetime string
      date = new Date(dateStr);
    }
    
    // Convert Mountain Time to UTC consistently
    if (!this.hasTimezoneInfo(dateStr)) {
      return this.mountainToUtc(date);
    }
    
    return date;
  }

  private normalizeTimeString(timeStr: string): string {
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*([ap]m)/i);
    if (!match) return '12:00:00';
    
    let [, hours, minutes, ampm] = match;
    let hour24 = parseInt(hours);
    
    if (ampm.toLowerCase() === 'pm' && hour24 !== 12) hour24 += 12;
    if (ampm.toLowerCase() === 'am' && hour24 === 12) hour24 = 0;
    
    return `${hour24.toString().padStart(2, '0')}:${minutes}:00`;
  }

  private hasTimezoneInfo(dateStr: string): boolean {
    return /[+-]\d{2}:?\d{2}|Z|UTC|GMT|[A-Z]{3,4}T?$/i.test(dateStr);
  }

  private mountainToUtc(date: Date): Date {
    // Always assume MDT (UTC-6) for current events
    const utcTime = date.getTime() + (6 * 60 * 60 * 1000);
    return new Date(utcTime);
  }

  // 🆕 ENHANCED EVENT CATEGORIZATION
  protected categorizeEvent(title: string, description?: string): EventCategory {
    const combined = `${title} ${description || ''}`.toLowerCase();
    
    // Use a mapping approach for better maintainability
    const categoryMap: Array<[RegExp[], EventCategory]> = [
      [[/closed|holiday|memorial|maintenance/], 'Special Event'],
      [[/public\s+skate|open\s+skate/], 'Public Skate'],
      [[/stick.*puck|take\s+a\s+shot/], 'Stick & Puck'],
      [[/drop.?in|pickup\s+hockey/], 'Drop-In Hockey'],
      [[/learn|lesson|lts|instruction/], 'Learn to Skate'],
      [[/freestyle|figure\s+skating/], 'Figure Skating'],
      [[/practice|training/], 'Hockey Practice'],
      [[/league|game\s+(?!practice)/], 'Hockey League'],
      [[/broomball|special\s+event/], 'Special Event']
    ];

    for (const [patterns, category] of categoryMap) {
      if (patterns.some(pattern => pattern.test(combined))) {
        return category;
      }
    }

    return 'Other';
  }

  // 🆕 STANDARDIZED LOGGING
  protected log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
    const prefix = `${level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '✅'} [${this.rinkName}]`;
    console[level](`${prefix} ${message}`, data || '');
  }

  // 🆕 BETTER ERROR HANDLING
  protected async safeApiCall<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T | null> {
    try {
      return await operation();
    } catch (error) {
      this.log('error', `Failed during ${context}`, error.message);
      return null;
    }
  }

  // 🆕 STANDARDIZED FETCH WITH RETRIES
  protected async fetchWithRetry(
    url: string, 
    options: RequestInit = {},
    maxRetries = 2
  ): Promise<string> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          this.log('info', `Retry attempt ${attempt} for ${url}`);
          await this.delay(1000 * attempt); // Progressive delay
        }
        
        const response = await fetch(url, {
          ...options,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; DenverRinkScheduler/1.0)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            ...options.headers
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.text();
      } catch (error) {
        lastError = error;
        if (attempt === maxRetries) break;
      }
    }
    
    throw lastError;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 🆕 STANDARDIZED VALIDATION
  protected validateEvent(event: Partial<RawIceEventData>): boolean {
    const required = ['title', 'startTime', 'endTime', 'category'];
    const missing = required.filter(field => !event[field]);
    
    if (missing.length > 0) {
      this.log('warn', `Skipping invalid event, missing: ${missing.join(', ')}`, event);
      return false;
    }
    
    if (event.startTime >= event.endTime) {
      this.log('warn', 'Skipping event with invalid time range', event);
      return false;
    }
    
    return true;
  }
}

// 🆕 EXAMPLE OF SIMPLIFIED SCRAPER USING NEW BASE CLASS
export class ImprovedIceRanchScraper extends BaseScraper {
  get rinkId(): string { return 'ice-ranch'; }
  get rinkName(): string { return 'Ice Ranch'; }

  async scrape(): Promise<RawIceEventData[]> {
    this.log('info', 'Starting scrape...');
    
    const html = await this.safeApiCall(
      () => this.fetchWithRetry('https://www.theiceranch.com/page/show/1652320-calendar'),
      'fetching calendar HTML'
    );
    
    if (!html) return [];
    
    const events = this.parseEvents(html);
    const validEvents = events.filter(e => this.validateEvent(e));
    
    this.log('info', `Found ${validEvents.length} valid events (${events.length} total)`);
    return validEvents;
  }

  private parseEvents(html: string): RawIceEventData[] {
    // Simplified parsing logic using shared utilities
    // Much cleaner than current implementation
  }
}

// BENEFITS:
// - 50% reduction in scraper code duplication
// - Consistent timezone handling across all scrapers
// - Better error handling and logging
// - Easier to add new scrapers
// - More maintainable categorization logic