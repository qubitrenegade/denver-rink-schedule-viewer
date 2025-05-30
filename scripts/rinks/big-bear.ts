// Big Bear scraper: fetches and parses events from Big Bear Ice Arena
import { RawIceEventData, EventCategory } from '../../src/types.js';
import { BaseScraper } from './base-scraper.js';
import fetch from 'node-fetch';

export class BigBearScraper extends BaseScraper {
  get rinkId() { return 'big-bear'; }
  get rinkName() { return 'Big Bear Ice Arena'; }
  private readonly baseUrl = 'https://bigbearicearena.ezfacility.com';

  // Categorize event by title
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
      LocationId: '13558',
      Sunday: 'true', Monday: 'true', Tuesday: 'true', Wednesday: 'true', Thursday: 'true', Friday: 'true', Saturday: 'true',
      StartTime: '12:00 AM', EndTime: '12:00 AM',
      'ReservationTypes[0].Selected': 'true', 'ReservationTypes[0].Id': '-1',
      'ReservationTypes[1].Id': '203425', 'ReservationTypes[2].Id': '208508', 'ReservationTypes[3].Id': '215333',
      'ReservationTypes[4].Id': '182117', 'ReservationTypes[5].Id': '227573', 'ReservationTypes[6].Id': '217778',
      'ReservationTypes[7].Id': '215383', 'ReservationTypes[8].Id': '271335', 'ReservationTypes[9].Id': '285107',
      'ReservationTypes[10].Id': '218387', 'ReservationTypes[11].Id': '215334', 'ReservationTypes[12].Id': '190860',
      'ReservationTypes[13].Id': '215332', 'ReservationTypes[14].Id': '224028',
      'Resources[0].Selected': 'true', 'Resources[0].Id': '-1', 'Resources[1].Id': '268382', 'Resources[2].Id': '268383',
      'Resources[3].Id': '309500', 'Resources[4].Id': '350941', 'Resources[5].Id': '354858', 'Resources[6].Id': '396198',
      StartDate: this.getTodayString(-3), EndDate: this.getTodayString(32)
    });
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0'
      },
      body: formData.toString()
    });
    if (!response.ok) throw new Error(`Failed to fetch Big Bear events: ${response.status} ${response.statusText}`);
    const eventsJson = await response.json();
    if (!Array.isArray(eventsJson)) throw new Error('Big Bear API did not return an array');
    // Map to RawIceEventData[]
    const events: RawIceEventData[] = eventsJson.map((ev: any) => {
      // The API returns times in Mountain Time (MT), but Date parses as UTC. To store as UTC, add 6 hours.
      const startTime = new Date(ev.start); startTime.setHours(startTime.getHours() + 6);
      const endTime = new Date(ev.end); endTime.setHours(endTime.getHours() + 6);
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
        eventUrl: undefined
      };
    });
    return events;
  }

  // Helper to get YYYY-MM-DD string for N days from today
  private getTodayString(offsetDays: number = 0): string {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
  }
}
