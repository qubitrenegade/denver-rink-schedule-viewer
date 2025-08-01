/**
 * Colorado timezone utilities with proper DST handling
 * 
 * Colorado observes:
 * - Mountain Standard Time (MST): UTC-7 (November - March)  
 * - Mountain Daylight Time (MDT): UTC-6 (March - November)
 * 
 * DST Rules (2007-present):
 * - Spring Forward: Second Sunday in March at 2:00 AM
 * - Fall Back: First Sunday in November at 2:00 AM
 */

export class ColoradoTimezone {
  /**
   * Determine if a given date falls within Daylight Saving Time in Colorado
   */
  static isDST(date: Date): boolean {
    const year = date.getFullYear();
    
    // Calculate DST boundaries for the year
    const dstStart = this.getDSTStart(year);
    const dstEnd = this.getDSTEnd(year);
    
    return date >= dstStart && date < dstEnd;
  }
  
  /**
   * Get DST start date (second Sunday in March at 2:00 AM)
   */
  private static getDSTStart(year: number): Date {
    const march = new Date(year, 2, 1); // March 1st
    const firstSunday = new Date(march);
    firstSunday.setDate(1 + (7 - march.getDay()) % 7);
    
    // Second Sunday in March
    const secondSunday = new Date(firstSunday);
    secondSunday.setDate(firstSunday.getDate() + 7);
    secondSunday.setHours(2, 0, 0, 0); // 2:00 AM
    
    return secondSunday;
  }
  
  /**
   * Get DST end date (first Sunday in November at 2:00 AM)
   */
  private static getDSTEnd(year: number): Date {
    const november = new Date(year, 10, 1); // November 1st
    const firstSunday = new Date(november);
    firstSunday.setDate(1 + (7 - november.getDay()) % 7);
    firstSunday.setHours(2, 0, 0, 0); // 2:00 AM
    
    return firstSunday;
  }
  
  /**
   * Get UTC offset for Colorado at a specific date
   * Returns offset in hours (negative for western timezones)
   */
  static getUTCOffset(date: Date): number {
    return this.isDST(date) ? -6 : -7; // MDT = UTC-6, MST = UTC-7
  }
  
  /**
   * Convert Mountain Time to UTC with proper DST handling
   * This replaces the hardcoded +6 hours conversion
   */
  static mountainTimeToUTC(localDate: Date): Date {
    const offset = this.getUTCOffset(localDate);
    const utcDate = new Date(localDate);
    
    // Subtract offset to convert to UTC (offset is negative for western zones)
    utcDate.setTime(utcDate.getTime() - (offset * 60 * 60 * 1000));
    
    return utcDate;
  }
  
  /**
   * Parse time string and convert to UTC, assuming Mountain Time if no timezone specified
   * This is a drop-in replacement for the existing parseMountainTime function
   */
  static parseMountainTime(timeStr: string, baseDate?: Date): Date {
    // Import patterns from existing regex patterns
    const TIMEZONE_INFO = /[+-]\d{2}:?\d{2}|Z|UTC|GMT|[A-Z]{2,4}T/i;
    const TIME_12_HOUR = /(\d{1,2}):?(\d{2})?\s*(AM|PM)/i;
    
    if (!timeStr) {
      return baseDate || new Date();
    }
    
    // Check if timezone info is already present
    const hasTimezone = TIMEZONE_INFO.test(timeStr);
    if (hasTimezone) {
      // Already has timezone info - parse and return as is
      return new Date(timeStr);
    }
    
    // No timezone specified - treat as Mountain Time
    // Parse the datetime components manually to avoid timezone interpretation issues
    const dateMatch = timeStr.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (dateMatch) {
      const year = parseInt(dateMatch[1]);
      const month = parseInt(dateMatch[2]) - 1; // JS months are 0-based
      const day = parseInt(dateMatch[3]);
      const hour = parseInt(dateMatch[4] || '0');
      const minute = parseInt(dateMatch[5] || '0');
      const second = parseInt(dateMatch[6] || '0');
      
      // Create date in Mountain Time and determine offset
      const mtDate = new Date(year, month, day, hour, minute, second);
      const offset = this.getUTCOffset(mtDate);
      
      // Convert to UTC: MT + (-offset) = UTC
      // For MDT (UTC-6): 14:30 MT + (-(-6)) = 14:30 + 6 = 20:30 UTC
      // For MST (UTC-7): 14:30 MT + (-(-7)) = 14:30 + 7 = 21:30 UTC
      const utcDate = new Date(mtDate.getTime() + (-offset * 60 * 60 * 1000));
      return utcDate;
    }
    
    // Fallback: try the old method
    const date = new Date(timeStr);
    if (!isNaN(date.getTime())) {
      return this.mountainTimeToUTC(date);
    }
    
    // Try parsing as time only (e.g., "2:30 PM")
    const timeMatch = timeStr.match(TIME_12_HOUR);
    if (timeMatch && baseDate) {
      const hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2] || '0');
      const isPM = timeMatch[3].toUpperCase() === 'PM';
      
      let adjustedHours = hours;
      if (isPM && hours !== 12) {
        adjustedHours += 12;
      } else if (!isPM && hours === 12) {
        adjustedHours = 0;
      }
      
      const result = new Date(baseDate);
      result.setHours(adjustedHours, minutes, 0, 0);
      
      // Convert from Mountain Time to UTC
      return this.mountainTimeToUTC(result);
    }
    
    // Fallback: return baseDate or current time
    return baseDate || new Date();
  }
  
  /**
   * Get current Colorado time as a Date object (for debugging/logging)
   */
  static now(): Date {
    const utcNow = new Date();
    const offset = this.getUTCOffset(utcNow);
    const coloradoTime = new Date(utcNow);
    coloradoTime.setTime(utcNow.getTime() + (offset * 60 * 60 * 1000));
    
    return coloradoTime;
  }
  
  /**
   * Format timezone name for display
   */
  static getTimezoneName(date: Date): string {
    return this.isDST(date) ? 'MDT' : 'MST';
  }
}