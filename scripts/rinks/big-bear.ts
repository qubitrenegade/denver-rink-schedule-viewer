import { RawIceEventData, EventCategory } from '../../src/types.js';
import { BaseScraper } from './base-scraper.js';
import fetch from 'node-fetch';

export class BigBearScraper extends BaseScraper {
  get rinkId(): string { return 'big-bear'; }
  get rinkName(): string { return 'Big Bear Ice Arena'; }

  private readonly baseUrl = 'https://bigbearicearena.ezfacility.com';

  protected categorizeBigBearEvent(title: string): EventCategory {
    const titleLower = title.toLowerCase();
    if (titleLower.includes('public skate')) return 'Public Skate';
    if (titleLower.includes('freestyle') || titleLower.includes('free style')) return 'Figure Skating';
    if (titleLower.includes('stick') && titleLower.includes('puck')) return 'Stick & Puck';
    if (titleLower.includes('drop-in') || titleLower.includes('drop in')) return 'Drop-In Hockey';
    if (titleLower.includes('party room') || titleLower.includes('hockey party')) return 'Special Event';
    return this.categorizeEvent(title);
  }

  async scrape(): Promise<RawIceEventData[]> {
    // POST to /Sessions/FilterResults to get all events as JSON
    const url = `${this.baseUrl}/Sessions/FilterResults`;
    const formData = new URLSearchParams({
      LocationId: '13558', // Big Bear Ice Arena
      Sunday: 'true',
      Monday: 'true',
      Tuesday: 'true',
      Wednesday: 'true',
      Thursday: 'true',
      Friday: 'true',
      Saturday: 'true',
      StartTime: '12:00 AM',
      EndTime: '12:00 AM',
      // Reservation Types:
      'ReservationTypes[0].Selected': 'true', // All Types (selected)
      'ReservationTypes[0].Id': '-1',         // All Types
      'ReservationTypes[1].Id': '203425',     // Drop - IN HOCKEY
      'ReservationTypes[2].Id': '208508',     // Drop-IN Goalie REGISTRATION
      'ReservationTypes[3].Id': '215333',     // (unknown)
      'ReservationTypes[4].Id': '182117',     // Free Style
      'ReservationTypes[5].Id': '227573',     // (unknown)
      'ReservationTypes[6].Id': '217778',     // (unknown)
      'ReservationTypes[7].Id': '215383',     // (unknown)
      'ReservationTypes[8].Id': '271335',     // (unknown)
      'ReservationTypes[9].Id': '285107',     // (unknown)
      'ReservationTypes[10].Id': '218387',    // (unknown)
      'ReservationTypes[11].Id': '215334',    // Open Stick & Puck
      'ReservationTypes[12].Id': '190860',    // (unknown)
      'ReservationTypes[13].Id': '215332',    // Public Skate
      'ReservationTypes[14].Id': '224028',    // (unknown)
      // Resources:
      'Resources[0].Selected': 'true',        // All Resources (selected)
      'Resources[0].Id': '-1',                // All Resources
      'Resources[1].Id': '268382',            // North Rink
      'Resources[2].Id': '268383',            // South Rink
      'Resources[3].Id': '309500',            // (unknown)
      'Resources[4].Id': '350941',            // (unknown)
      'Resources[5].Id': '354858',            // (unknown)
      'Resources[6].Id': '396198',            // (unknown)
      StartDate: this.getTodayString(-3), // 3 days before today
      EndDate: this.getTodayString(32)   // 32 days after today
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0'
      },
      body: formData.toString()
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Big Bear events: ${response.status} ${response.statusText}`);
    }
    const eventsJson = await response.json();
    if (!Array.isArray(eventsJson)) {
      throw new Error('Big Bear API did not return an array');
    }
    // eventsJson is an array of event objects

    // Map to RawIceEventData[]
    const events: RawIceEventData[] = eventsJson.map((ev: any) => {
      // The API returns times in Mountain Time (MT), but Date parses as UTC.
      // To store as UTC, add 6 hours to shift from MT to UTC (for MDT).
      const startTime = new Date(ev.start);
      const endTime = new Date(ev.end);
      // Shift both times forward by 6 hours
      startTime.setHours(startTime.getHours() + 6);
      endTime.setHours(endTime.getHours() + 6);
      const rinkName = ev.resourceName || (ev.venues && ev.venues[0]?.Name) || 'Main Rink';
      const category = this.categorizeBigBearEvent(ev.title || ev.reservationType || '');
      return {
        id: `big-bear-${ev.id}`,
        rinkId: 'big-bear',
        title: this.cleanTitle(ev.title || ''),
        startTime,
        endTime,
        description: `${rinkName}${ev.description ? ' - ' + ev.description : ''}`,
        category,
        isFeatured: false,
        eventUrl: undefined // No direct event URL
      };
    });
    // Sort by start time
    events.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    console.log(`🐻 Big Bear: Parsed ${events.length} events from API.`);
    return events;
  }

  // Helper to get YYYY-MM-DD string for N days from today
  private getTodayString(offsetDays: number = 0): string {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
  }
}
