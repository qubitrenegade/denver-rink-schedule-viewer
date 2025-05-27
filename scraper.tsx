import { RawIceEventData } from './types';
import { IceRanchScraper } from './rinks/ice-ranch';
import { createFamilySportsCenterScraper, createSportsComplexScraper } from './rinks/ssprd';

export class RealRinkScraper {
  private scrapers = [
    new IceRanchScraper(),
    createFamilySportsCenterScraper(),
    createSportsComplexScraper(),
  ];

  async scrapeAllRinks(): Promise<RawIceEventData[]> {
    console.log('🚀 Starting modular scraping...');
    
    const results = await Promise.allSettled(
      this.scrapers.map(scraper => scraper.scrape())
    );
    
    const allEvents: RawIceEventData[] = [];
    
    results.forEach((result, index) => {
      const scraper = this.scrapers[index];
      
      if (result.status === 'fulfilled') {
        allEvents.push(...result.value);
        console.log(`✅ ${scraper.rinkName}: ${result.value.length} events`);
      } else {
        console.log(`❌ ${scraper.rinkName} failed: ${result.reason.message}`);
      }
    });
    
    console.log(`✅ Scraping complete: ${allEvents.length} events total`);
    return allEvents;
  }

  // Individual scraper methods for testing specific rinks
  async scrapeIceRanch(): Promise<RawIceEventData[]> {
    const scraper = new IceRanchScraper();
    return scraper.scrape();
  }

  async scrapeFamilySportsCenter(): Promise<RawIceEventData[]> {
    const scraper = createFamilySportsCenterScraper();
    return scraper.scrape();
  }

  async scrapeSportsComplex(): Promise<RawIceEventData[]> {
    const scraper = createSportsComplexScraper();
    return scraper.scrape();
  }
}
