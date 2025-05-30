#!/usr/bin/env bun

import { RawIceEventData } from '../src/types.js';
import { IceRanchScraper } from './rinks/ice-ranch.js';
import { BigBearScraper } from './rinks/big-bear.js';
import { DURitchieScraper } from './rinks/du-ritchie.js';
import { FoothillsEdgeScraper } from './rinks/foothills-edge.js';
import { createSSPRD249Scraper, createSSPRD250Scraper } from './rinks/ssprd.js';
import { DataFileWriter } from './utils/file-writer.js';

interface ScraperConfig {
  id: string;
  name: string;
  scraper: any;
  outputFile: string;
}

const SCRAPERS: ScraperConfig[] = [
  {
    id: 'ice-ranch',
    name: 'Ice Ranch',
    scraper: new IceRanchScraper(),
    outputFile: 'ice-ranch.json'
  },
  {
    id: 'big-bear', 
    name: 'Big Bear Ice Arena',
    scraper: new BigBearScraper(),
    outputFile: 'big-bear.json'
  },
  {
    id: 'du-ritchie',
    name: 'DU Ritchie Center',
    scraper: new DURitchieScraper(),
    outputFile: 'du-ritchie.json'
  },
  {
    id: 'foothills-edge',
    name: 'Foothills Ice Arena (Edge)',
    scraper: new FoothillsEdgeScraper(),
    outputFile: 'foothills-edge.json'
  },
  {
    id: 'ssprd-249',
    name: 'SSPRD Family Sports (Schedule 249)',
    scraper: createSSPRD249Scraper(),
    outputFile: 'ssprd-249.json'
  },
  {
    id: 'ssprd-250',
    name: 'SSPRD South Suburban (Schedule 250)', 
    scraper: createSSPRD250Scraper(),
    outputFile: 'ssprd-250.json'
  }
];

class ScraperOrchestrator {
  private writer = new DataFileWriter();

  async scrapeRink(rinkId: string): Promise<void> {
    const config = SCRAPERS.find(s => s.id === rinkId);
    if (!config) {
      throw new Error(`Unknown rink ID: ${rinkId}. Available: ${SCRAPERS.map(s => s.id).join(', ')}`);
    }

    console.log(`\n🚀 Starting scrape for ${config.name}...`);
    const startTime = Date.now();

    try {
      const events: RawIceEventData[] = await config.scraper.scrape();
      await this.writer.writeRinkData(config.id, events);
      await this.writer.writeFacilityMetadata(config.id, 'success', events.length);
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`✅ ${config.name} completed successfully in ${duration}s: ${events.length} events`);
      
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      await this.writer.writeFacilityMetadata(config.id, 'error', 0, errorMessage);
      console.error(`❌ ${config.name} failed after ${duration}s: ${errorMessage}`);
      throw error;
    }
  }

  async scrapeAll(): Promise<void> {
    console.log('🌟 Starting full scrape of all rinks...');
    const startTime = Date.now();
    
    const results = await Promise.allSettled(
      SCRAPERS.map(config => this.scrapeRink(config.id))
    );
    
    let successCount = 0;
    let errorCount = 0;
    
    results.forEach((result, index) => {
      const config = SCRAPERS[index];
      if (result.status === 'fulfilled') {
        successCount++;
      } else {
        errorCount++;
        console.error(`❌ ${config.name} failed: ${result.reason.message}`);
      }
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n🏁 Full scrape completed in ${duration}s:`);
    console.log(`   ✅ Successful: ${successCount}/${SCRAPERS.length}`);
    console.log(`   ❌ Failed: ${errorCount}/${SCRAPERS.length}`);
    console.log(`📋 Individual facility data and metadata files updated`);
    
    if (errorCount > 0) {
      process.exit(1); // Exit with error code for GitHub Actions
    }
  }

  async showStatus(): Promise<void> {
    console.log('\n📊 Scraper Status Report');
    console.log('========================');
    console.log('Loading status from individual facility metadata files...\n');

    for (const config of SCRAPERS) {
      const metadata = await this.writer.readFacilityMetadata(config.id);
      
      if (metadata) {
        console.log(`${metadata.status === 'success' ? '✅' : '❌'} ${metadata.displayName}`);
        console.log(`   Last Attempt: ${new Date(metadata.lastAttempt).toLocaleString()}`);
        if (metadata.lastSuccessfulScrape) {
          console.log(`   Last Success: ${new Date(metadata.lastSuccessfulScrape).toLocaleString()}`);
        }
        console.log(`   Events: ${metadata.eventCount}`);
        if (metadata.errorMessage) {
          console.log(`   Error: ${metadata.errorMessage}`);
        }
        console.log('');
      } else {
        console.log(`❓ ${config.name}: No metadata found`);
        console.log('');
      }
    }
  }
}

// CLI Processing
async function main() {
  const orchestrator = new ScraperOrchestrator();
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Denver Rink Schedule Scraper

Usage:
  bun run scripts/scraper.ts [options]

Options:
  --rink <id>     Scrape specific rink (${SCRAPERS.map(s => s.id).join(', ')})
  --ssprd         Scrape both SSPRD schedules (249 and 250)
  --status        Show current scraping status
  --test          Test mode (show what would be scraped)
  --local         Local development mode
  --help          Show this help

Examples:
  bun run scraper.ts --rink ice-ranch
  bun run scraper.ts --rink du-ritchie
  bun run scraper.ts --ssprd  
  bun run scraper.ts          (scrape all rinks)

Note: Individual facility files and metadata are generated. Legacy combined.json is no longer used.
`);
    return;
  }

  try {
    if (args.includes('--status')) {
      await orchestrator.showStatus();
    } else if (args.includes('--test')) {
      console.log('🧪 Test mode - Available scrapers:');
      SCRAPERS.forEach(config => {
        console.log(`   ${config.id}: ${config.name}`);
      });
    } else if (args.includes('--ssprd')) {
      await orchestrator.scrapeRink('ssprd-249');
      await orchestrator.scrapeRink('ssprd-250');
    } else {
      const rinkIndex = args.indexOf('--rink');
      if (rinkIndex !== -1 && args[rinkIndex + 1]) {
        const rinkId = args[rinkIndex + 1];
        await orchestrator.scrapeRink(rinkId);
      } else {
        await orchestrator.scrapeAll();
      }
    }
  } catch (error) {
    console.error('💥 Scraper failed:', error.message);
    process.exit(1);
  }
}

await main();
