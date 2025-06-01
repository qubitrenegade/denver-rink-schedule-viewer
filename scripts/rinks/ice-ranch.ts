// IceRanchScraper: fetches and parses events from Ice Ranch RSS feed
import { RawIceEventData } from '../../src/types.js';
import { BaseScraper } from './base-scraper.js';
import { parseStringPromise } from 'xml2js';

// Tag ID to category mapping (from ice-ranch.html UI)
const ICE_RANCH_TAGS: Record<string, string> = {
  '1652315': 'Home',
  '1652320': 'Calendar',
  '1718896': 'All Ages Stick & Puck',
  '1718895': 'Adult Drop In',
  '1718913': 'Teen Drop In',
  '1718914': '12 & Under Stick & Puck',
  '1718915': '13 & Over Stick & Puck',
  '1718916': 'Coach Ice',
  '1718917': 'Public Skate',
  '7870619': 'Adult Lunch Leagues & Learn to Play',
};

const ICE_RANCH_RSS_URL = 'https://www.theiceranch.com/event_rss_feed?tags=1652315,1652320,1718896,1718895,1718913,1718914,1718915,1718916,1718917,7870619';

export class IceRanchScraper extends BaseScraper {
  get rinkId() { return 'ice-ranch'; }
  get rinkName() { return 'Ice Ranch'; }

  async scrape(): Promise<RawIceEventData[]> {
    try {
      console.log(`🧊 Scraping Ice Ranch events from RSS feed...`);
      const xml = await this.fetchWithFallback(ICE_RANCH_RSS_URL);
      const parsed = await parseStringPromise(xml, { explicitArray: false });
      const items = parsed?.rss?.channel?.item;
      if (!items) {
        console.warn('No events found in Ice Ranch RSS feed.');
        return [];
      }
      // Ensure items is always an array
      const eventsArr = Array.isArray(items) ? items : [items];
      const events: RawIceEventData[] = eventsArr.map((item: any, idx: number) => {
        // Example title: "Sunday June 1, 2025: Coach's Ice"
        let title: string = item.title || 'Untitled Event';
        // Remove date prefix if present (e.g., "Sunday June 1, 2025: ")
        title = title.replace(/^[A-Za-z]+ [A-Za-z]+ \d{1,2}, \d{4}:\s*/, '');
        const description: string = item.description || '';
        const link: string = item.link || '';
        const pubDate: string = item.pubDate || '';
        // Try to extract start time from pubDate
        const startTime = pubDate ? new Date(pubDate) : undefined;
        // Try to extract end time from description (e.g., "Time:  9:15am - 10:15am")
        let endTime: Date | undefined = undefined;
        const timeMatch = description.match(/Time:\s*([\d:apm ]+)-(\d{1,2}:\d{2}[ap]m)/i);
        if (timeMatch && startTime) {
          // Parse end time on same day as startTime
          const [ , , endStr ] = timeMatch;
          const [endHour, endMinute, endPeriod] = endStr.match(/(\d{1,2}):(\d{2})(am|pm)/i) || [];
          if (endHour && endMinute && endPeriod) {
            const end = new Date(startTime);
            let hour = parseInt(endHour, 10);
            if (endPeriod.toLowerCase() === 'pm' && hour < 12) hour += 12;
            if (endPeriod.toLowerCase() === 'am' && hour === 12) hour = 0;
            end.setHours(hour, parseInt(endMinute, 10), 0, 0);
            endTime = end;
          }
        }
        // Try to extract category from tags in description
        let category = 'Other';
        const tagMatch = description.match(/Tag\(s\): ([^<]+)/);
        if (tagMatch) {
          // Use the first matching tag that is in our mapping
          const tags = tagMatch[1].split(',').map(t => t.trim());
          for (const tag of tags) {
            const mapped = Object.values(ICE_RANCH_TAGS).find(cat => tag === cat);
            if (mapped) {
              category = mapped;
              break;
            }
          }
        } else {
          // Fallback: try to categorize by title
          category = this.categorizeEvent(title);
        }
        return {
          id: `ice-ranch-${startTime?.getTime() || idx}`,
          rinkId: this.rinkId,
          title,
          startTime: startTime || new Date(),
          endTime: endTime || startTime || new Date(),
          category,
          description: description.replace(/<br\s*\/?\s*>/gi, '\n'),
          eventUrl: link,
        };
      });
      events.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      console.log(`🧊 Ice Ranch: Found ${events.length} events from RSS`);
      return events;
    } catch (error: any) {
      console.error('❌ Ice Ranch RSS scraping failed:', error.message);
      throw error;
    }
  }
}
