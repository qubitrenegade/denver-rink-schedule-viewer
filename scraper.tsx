
import { RawIceEventData } from './types';
import { IceRanchScraper } from './rinks/ice-ranch';
import { createSSPRD249Scraper, createSSPRD250Scraper } from './rinks/ssprd';
import { BigBearScraper } from './rinks/big-bear'; 
// Placeholder for other rink scrapers if they are created (DU, Foothills)
// import { DURitchieScraper } from './rinks/du-ritchie';
// import { FoothillsEdgeScraper } from './rinks/foothills-edge';


export class RealRinkScraper {
  scrapers = [ // Made public for App.tsx to potentially access scraper names/IDs for category collection
    new IceRanchScraper(),
    new BigBearScraper(),
    // TODO: Implement and add scrapers for DU Ritchie, Foothills Edge if desired
    // new DURitchieScraper(),
    // new FoothillsEdgeScraper(),
    createSSPRD249Scraper(), 
    createSSPRD250Scraper(), 
  ];

  async scrapeAllRinks(): Promise<RawIceEventData[]> {
    console.log('🚀 Starting modular scraping for all configured live sources...');
    
    const results = await Promise.allSettled(
      this.scrapers.map(scraper => scraper.scrape())
    );
    
    const allEvents: RawIceEventData[] = [];
    
    results.forEach((result, index) => {
      const scraperInstance = this.scrapers[index]; 
      const scraperName = scraperInstance.rinkName || `Scraper ${index}`; 
      
      if (result.status === 'fulfilled') {
        allEvents.push(...result.value);
        console.log(`✅ ${scraperName}: ${result.value.length} events`);
      } else {
        console.error(`❌ ${scraperName} failed: ${(result.reason as Error).message}`);
        // Optionally, include more details from result.reason if helpful
        if ((result.reason as Error).stack) {
            console.error(`   Stack: ${(result.reason as Error).stack}`);
        }
      }
    });
    
    console.log(`✅ Scraping complete: ${allEvents.length} events total from live sources.`);
    return allEvents;
  }

  // Individual scraper methods for testing specific rinks/schedules
  async scrapeIceRanch(): Promise<RawIceEventData[]> {
    const scraper = new IceRanchScraper();
    return scraper.scrape();
  }
   async scrapeBigBear(): Promise<RawIceEventData[]> {
    const scraper = new BigBearScraper();
    return scraper.scrape();
  }

  async scrapeSSPRD249(): Promise<RawIceEventData[]> {
    const scraper = createSSPRD249Scraper();
    return scraper.scrape();
  }

  async scrapeSSPRD250(): Promise<RawIceEventData[]> {
    const scraper = createSSPRD250Scraper();
    return scraper.scrape();
  }
}