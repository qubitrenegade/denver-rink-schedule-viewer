// workers/helpers/scraper-helpers.ts - Common functions for all scrapers

import { getRinkConfig } from '../shared/rink-config';
import { TIME_PATTERNS, HTML_PATTERNS, VALIDATION_PATTERNS, RegexHelpers } from '../shared/regex-patterns';
import { CORS_HEADERS, DEFAULT_CONFIG } from '../shared/constants';
import { ColoradoTimezone } from '../shared/timezone-utils';

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
  rinks: {
    rinkId: string;
    rinkName: string;
  }[];
  lastSuccessfulScrape?: string;
}

export interface RinkConfig {
  facilityName: string;
  displayName: string;
  sourceUrl: string;
  rinkName: string;
  aggregatedRinks?: {rinkId: string, rinkName: string}[];
}

export class ScraperHelpers {

  /**
   * Get CORS headers for responses
   */
  static corsHeaders(): Record<string, string> {
    return CORS_HEADERS;
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
    // Random delay between 5 minutes and maxMinutes
    const minMinutes = 5;
    const randomMinutes = Math.floor(Math.random() * (maxMinutes - minMinutes) + minMinutes);
    return randomMinutes * 60 * 1000; // Convert to milliseconds
  }

  /**
   * Get alarm time with random splay delay
   */
  static getAlarmTime(splayMinutesEnvVar?: string): number {
    const splayMinutes = parseInt(splayMinutesEnvVar || DEFAULT_CONFIG.SCRAPER_SPLAY_MINUTES.toString(), 10);
    const delay = ScraperHelpers.getRandomDelay(splayMinutes);
    return Date.now() + delay;
  }

  /**
   * Get the next scheduled time for scraping with random splay
   */
  static getNextScheduledTime(splayMinutes: number = DEFAULT_CONFIG.SCRAPER_SPLAY_MINUTES): Date {
    const now = new Date();
    const delayMs = ScraperHelpers.getRandomDelay(splayMinutes);
    const nextTime = new Date(now.getTime() + delayMs);

    console.log(`📅 Next scheduled time: ${nextTime.toISOString()} (splay: ${Math.floor(delayMs/60000)} minutes)`);

    return nextTime;
  }

  /**
   * Write events and metadata to KV storage using shared config
   */
  static async writeToKV(
    kvNamespace: KVNamespace,
    rinkId: string,
    events: RawIceEventData[]
  ): Promise<void>;
  static async writeToKV(
    kvNamespace: KVNamespace,
    rinkId: string,
    events: RawIceEventData[],
    customConfig?: RinkConfig,
    options?: { mode: 'overwrite' | 'merge'; maxAgeDays?: number }
  ): Promise<void> {
    let config: RinkConfig;
    const { mode = 'merge', maxAgeDays = 30 } = options || {};

    if (customConfig) {
      // Use provided custom config (for aggregations)
      config = customConfig;
    } else {
      // Use shared config lookup (for individual rinks)
      config = getRinkConfig(rinkId);
    }

    let finalEvents = events;

    if (mode === 'merge') {
      // Read existing events from KV
      const existingData = await kvNamespace.get(`events:${rinkId}`);
      const existingEvents: RawIceEventData[] = existingData ? JSON.parse(existingData) : [];

      // Merge new events with existing
      const allEvents = [...existingEvents, ...events];

      // Deduplicate based on title and startTime
      const uniqueEvents = allEvents.filter((event, index, self) =>
        index === self.findIndex((e) =>
          e.title === event.title &&
          e.startTime === event.startTime
        )
      );

      // Filter out events older than maxAgeDays
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);
      
      finalEvents = uniqueEvents.filter(event => {
        const eventDate = new Date(event.startTime);
        return eventDate >= cutoffDate;
      });

      console.log(`📊 ${rinkId}: ${existingEvents.length} existing + ${events.length} new = ${allEvents.length} total → ${finalEvents.length} after dedup & cleanup`);
    }

    // Store events data
    await kvNamespace.put(`events:${rinkId}`, JSON.stringify(finalEvents));

    // Store metadata
    const metadata: FacilityMetadata = {
      facilityId: rinkId,
      facilityName: config.facilityName,
      displayName: config.displayName,
      lastAttempt: new Date().toISOString(),
      status: 'success',
      eventCount: finalEvents.length,
      sourceUrl: config.sourceUrl,
      rinks: [{ rinkId, rinkName: config.rinkName }],
      lastSuccessfulScrape: new Date().toISOString()
    };

    await kvNamespace.put(`metadata:${rinkId}`, JSON.stringify(metadata));

    console.log(`💾 Stored ${finalEvents.length} events and metadata for ${rinkId}`);
  }

  /**
   * Write error metadata to KV storage when scraping fails using shared config
   */
  static async writeErrorMetadata(
    kvNamespace: KVNamespace,
    rinkId: string,
    error: any,
    customConfig?: RinkConfig
  ): Promise<void> {
    let config: RinkConfig;

    if (customConfig) {
      // Use provided custom config (for aggregations)
      config = customConfig;
    } else {
      // Use shared config lookup (for individual rinks)
      config = getRinkConfig(rinkId);
    }

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
   * Handles timezone conversion from Mountain Time to UTC with proper DST awareness
   */
  static parseMountainTime(timeStr: string, baseDate?: Date): Date {
    // Use the new DST-aware timezone utility for accurate timezone conversion
    return ColoradoTimezone.parseMountainTime(timeStr, baseDate);
  }

  /**
   * Clean and normalize event titles
   */
  static cleanTitle(rawTitle: string): string {
    return RegexHelpers.cleanTitle(rawTitle);
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
    if (titleLower.includes('freestyle') || titleLower.includes('free style') || titleLower.includes('figure')) {
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

  /**
   * Common Durable Object scheduler fetch handler
   */
  static async handleSchedulerFetch(
    request: Request,
    state: any,
    env: any,
    rinkId: string,
    runScraperFn: () => Promise<Response>
  ): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/status') {
      const nextAlarm = await state.storage.getAlarm();
      const lastRun = await state.storage.get('lastRun');

      return ScraperHelpers.jsonResponse({
        nextAlarm: nextAlarm ? new Date(nextAlarm).toISOString() : null,
        lastRun: lastRun || null,
        rinkId
      });
    }

    if (path === '/schedule' || request.method === 'GET') {
      const alarmTime = ScraperHelpers.getAlarmTime(env.SCRAPER_SPLAY_MINUTES);
      await state.storage.setAlarm(alarmTime);

      return new Response(
        `${rinkId} Worker - Scheduling alarm for ${new Date(alarmTime).toISOString()}`,
        { headers: ScraperHelpers.corsHeaders() }
      );
    }

    if (request.method === 'POST') {
      return await runScraperFn();
    }

    return new Response(`${rinkId} Scheduler - Use GET to schedule, POST to run manually, /status for info`, {
      headers: ScraperHelpers.corsHeaders()
    });
  }

  /**
   * Common Durable Object alarm handler with automatic rescheduling
   */
  static async handleSchedulerAlarm(
    state: any,
    env: any,
    rinkId: string,
    runScraperFn: () => Promise<Response>
  ): Promise<void> {
    console.log(`⏰ ${rinkId} alarm triggered at ${new Date().toISOString()}`);

    try {
      await runScraperFn();

      // Schedule next alarm with configured splay
      const splayMinutes = parseInt(env.SCRAPER_SPLAY_MINUTES || DEFAULT_CONFIG.SCRAPER_SPLAY_MINUTES.toString(), 10);
      const nextAlarmTime = ScraperHelpers.getNextScheduledTime(splayMinutes);
      await state.storage.setAlarm(nextAlarmTime);
      console.log(`📅 Next ${rinkId} alarm scheduled for ${nextAlarmTime.toISOString()}`);

    } catch (error) {
      console.error(`❌ ${rinkId} alarm failed:`, error);

      // Still schedule next alarm even if this one failed
      const splayMinutes = parseInt(env.SCRAPER_SPLAY_MINUTES || DEFAULT_CONFIG.SCRAPER_SPLAY_MINUTES.toString(), 10);
      const nextAlarmTime = ScraperHelpers.getNextScheduledTime(splayMinutes);
      await state.storage.setAlarm(nextAlarmTime);
    }
  }

  /**
   * Enhanced date parsing for various Mountain Time formats
   */
  static parseVariousMountainTimeFormats(dateStr: string, timeStr?: string): Date {
    // Try parsing as complete datetime first
    const date = ScraperHelpers.parseMountainTime(dateStr);

    // If we have separate time string, combine them
    if (timeStr) {
      const baseDate = new Date(dateStr);
      const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*([AP])\.?M\.?/i);
      if (timeMatch) {
        let hours = parseInt(timeMatch[1], 10);
        const minutes = parseInt(timeMatch[2], 10);
        const ampm = timeMatch[3].toLowerCase();

        if (ampm === 'p' && hours !== 12) hours += 12;
        if (ampm === 'a' && hours === 12) hours = 0;

        baseDate.setHours(hours, minutes, 0, 0);
        // Use DST-aware timezone conversion instead of hardcoded +6 hours
        return ColoradoTimezone.mountainTimeToUTC(baseDate);
      }
    }

    return date;
  }
}

