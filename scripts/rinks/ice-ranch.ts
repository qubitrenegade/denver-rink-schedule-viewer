import { RawIceEventData } from '../../src/types.js';
import { BaseScraper } from './base-scraper.js';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

export class IceRanchScraper extends BaseScraper {
  get rinkId(): string { return 'ice-ranch'; }
  get rinkName(): string { return 'Ice Ranch'; }

  private readonly baseUrl = 'https://www.theiceranch.com';

  // Parse time and properly handle Mountain Time zone
  private parseIceRanchTime(timeStr: string, baseDate: Date): Date {
    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*([ap]m)/i);
    if (!timeMatch) return baseDate;
    
    let hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);
    const ampm = timeMatch[3].toLowerCase();
    
    // Convert to 24-hour format
    if (ampm === 'pm' && hours !== 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;
    
    // Create date in Mountain Time, then convert to UTC for storage
    // Mountain Daylight Time (MDT) is UTC-6 during summer months
    // Mountain Standard Time (MST) is UTC-7 during winter months
    // Since we're dealing with current/future events, assume MDT (UTC-6)
    const result = new Date(baseDate);
    
    // Set the time as if it were UTC first
    result.setUTCHours(hours, minutes, 0, 0);
    
    // Then add 6 hours to convert from Mountain Time to UTC
    result.setTime(result.getTime() + (6 * 60 * 60 * 1000));
    
    return result;
  }

  async scrape(): Promise<RawIceEventData[]> {
    try {
      console.log('🏒 Scraping Ice Ranch...');
      const url = 'https://www.theiceranch.com/page/show/1652320-calendar';
      const html = await this.fetchWithFallback(url);

      // Use cheerio for robust HTML parsing
      const $ = cheerio.load(html);
      const events: RawIceEventData[] = [];
      let memorialDayFound = false;
      let eventsFound = 0;

      // Find all calendar day cells
      $('#monthViewCalendar td.day, #monthViewCalendar td.day.weekendDay').each((cellIndex: number, cell: cheerio.Element) => {
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

        // Check for Memorial Day or Closed events
        const cellText = $cell.text();
        if (cellText.includes('Memorial Day') || cellText.includes('Closed')) {
          memorialDayFound = true;
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
          eventsFound++;
          return;
        }

        // For each event in the cell
        $cell.find('div.vevent.scheduled').each((eventIdx: number, vevent: cheerio.Element) => {
          const $vevent = $(vevent);
          // Title
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
          if (startTimeStr && endTimeStr) {
            // Parse ISO8601 with timezone offset
            startTime = new Date(startTimeStr);
            endTime = new Date(endTimeStr);
          }
          // Fallback: try to parse from text if abbrs missing
          if ((!startTime || !endTime) && timeLi.length) {
            const timeText = timeLi.text();
            const match = timeText.match(/(\d{1,2}:\d{2}[ap]m)[^\d]+(\d{1,2}:\d{2}[ap]m)/i);
            if (match && eventDate) {
              startTime = this.parseIceRanchTime(match[1], eventDate);
              endTime = this.parseIceRanchTime(match[2], eventDate);
            }
          }
          // Event URL
          let eventUrl: string | undefined = $vevent.find('h5.summary a').attr('href');
          if (eventUrl && !eventUrl.startsWith('http')) eventUrl = this.baseUrl + eventUrl;

          if (startTime && endTime) {
            events.push({
              id: `ice-ranch-${eventDate.getTime()}-${cellIndex}-${eventIdx}`,
              rinkId: this.rinkId,
              title: title,
              startTime: startTime,
              endTime: endTime,
              category: this.categorizeEvent(title),
              description: `Scraped from Ice Ranch calendar`,
              eventUrl: eventUrl
            });
            eventsFound++;
          }
        });
      });

      console.log(`🎯 Memorial Day found: ${memorialDayFound}`);
      console.log(`📅 Total events found: ${eventsFound}`);
      events.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      fs.writeFileSync(path.join(__dirname, '../../public/data/ice-ranch.json'), JSON.stringify(events, null, 2));
      return events;
    } catch (error: any) {
      console.error('❌ Ice Ranch scraping failed:', error.message);
      throw error;
    }
  }
}
