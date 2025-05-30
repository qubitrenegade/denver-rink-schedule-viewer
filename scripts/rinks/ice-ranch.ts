// Ice Ranch scraper: fetches and parses events from the Ice Ranch calendar
import { RawIceEventData } from '../../src/types.js';
import { BaseScraper } from './base-scraper.js';
import * as cheerio from 'cheerio';

export class IceRanchScraper extends BaseScraper {
  get rinkId() { return 'ice-ranch'; }
  get rinkName() { return 'Ice Ranch'; }

  // Parse time and handle Mountain Time zone
  private parseIceRanchTime(timeStr: string, baseDate: Date): Date {
    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*([ap]m)/i);
    if (!timeMatch) return baseDate;
    let hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);
    const ampm = timeMatch[3].toLowerCase();
    if (ampm === 'pm' && hours !== 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;
    // Assume MDT (UTC-6)
    const result = new Date(baseDate);
    result.setUTCHours(hours, minutes, 0, 0);
    result.setTime(result.getTime() + (6 * 60 * 60 * 1000));
    return result;
  }

  async scrape(): Promise<RawIceEventData[]> {
    // Fetch and parse Ice Ranch calendar
    const url = 'https://www.theiceranch.com/page/show/1652320-calendar';
    const html = await this.fetchWithFallback(url);
    const $ = cheerio.load(html);
    const events: RawIceEventData[] = [];
    // Find all calendar day cells
    $('#monthViewCalendar td.day, #monthViewCalendar td.day.weekendDay').each((cellIndex, cell) => {
      const $cell = $(cell);
      const dateLink = $cell.find('a.dateLink');
      if (dateLink.length === 0) return;
      // Extract date from link href
      const dateHref = dateLink.attr('href');
      let eventDate: Date | undefined = undefined;
      if (dateHref) {
        const dateMatch = dateHref.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
        if (dateMatch) {
          const [, year, month, day] = dateMatch;
          eventDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        }
      }
      if (!eventDate) return;
      // Check for closed/holiday events
      const cellText = $cell.text();
      if (cellText.includes('Memorial Day') || cellText.includes('Closed')) {
        events.push({
          id: `ice-ranch-memorial-${cellIndex}`,
          rinkId: this.rinkId,
          title: cellText.includes('Memorial Day') ? 'Closed: Memorial Day' : 'Rink Closed',
          startTime: eventDate,
          endTime: new Date(eventDate.getTime() + 24 * 60 * 60 * 1000),
          category: 'Special Event',
          description: `Holiday closure`,
          eventUrl: undefined
        });
        return;
      }
      // For each event in the cell
      $cell.find('div.vevent.scheduled').each((eventIdx, vevent) => {
        const $vevent = $(vevent);
        let title = $vevent.find('h5.summary a').text().trim();
        if (!title) title = 'Ice Time';
        // Times
        const timeLi = $vevent.find('ul.details li.time');
        let startTime: Date | undefined = undefined;
        let endTime: Date | undefined = undefined;
        let startTimeStr = '', endTimeStr = '';
        if (timeLi.length) {
          const abbrs = timeLi.find('abbr.dtstart, abbr.dtend');
          if (abbrs.length >= 2) {
            startTimeStr = abbrs.eq(0).attr('title') || '';
            endTimeStr = abbrs.eq(1).attr('title') || '';
          }
        }
        if (startTimeStr && eventDate) startTime = this.parseIceRanchTime(startTimeStr, eventDate);
        if (endTimeStr && eventDate) endTime = this.parseIceRanchTime(endTimeStr, eventDate);
        if (!startTime || !endTime) return;
        events.push({
          id: `ice-ranch-${cellIndex}-${eventIdx}`,
          rinkId: this.rinkId,
          title,
          startTime,
          endTime,
          category: this.categorizeEvent(title),
          description: $vevent.find('ul.details li.description').text().trim() || undefined,
          eventUrl: undefined
        });
      });
    });
    return events;
  }
}
