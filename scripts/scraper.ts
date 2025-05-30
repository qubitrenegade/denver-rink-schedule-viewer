#!/usr/bin/env bun

// Main orchestrator for scraping all rink data and writing output files
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
  { id: 'ice-ranch', name: 'Ice Ranch', scraper: new IceRanchScraper(), outputFile: 'ice-ranch.json' },
  { id: 'big-bear', name: 'Big Bear Ice Arena', scraper: new BigBearScraper(), outputFile: 'big-bear.json' },
  { id: 'du-ritchie', name: 'DU Ritchie Center', scraper: new DURitchieScraper(), outputFile: 'du-ritchie.json' },
  { id: 'foothills-edge', name: 'Foothills Ice Arena (Edge)', scraper: new FoothillsEdgeScraper(), outputFile: 'foothills-edge.json' },
  { id: 'ssprd-249', name: 'SSPRD Family Sports (Schedule 249)', scraper: createSSPRD249Scraper(), outputFile: 'ssprd-249.json' },
  { id: 'ssprd-250', name: 'SSPRD South Suburban (Schedule 250)', scraper: createSSPRD250Scraper(), outputFile: 'ssprd-250.json' }
];

class ScraperOrchestrator {
  private writer = new DataFileWriter();

  async scrapeRink(rinkId: string): Promise<number> {
    const config = SCRAPERS.find(s => s.id === rinkId);
    if (!config) throw new Error(`Unknown rink ID: ${rinkId}. Available: ${SCRAPERS.map(s => s.id).join(', ')}`);
    console.log(`\n🚀 Starting scrape for ${config.name}...`);
    const startTime = Date.now();
    try {
      const events: RawIceEventData[] = await config.scraper.scrape();
      await this.writer.writeRinkData(config.id, events);
      await this.writer.writeFacilityMetadata(config.id, 'success', events.length);
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`✅ ${config.name} completed successfully in ${duration}s: ${events.length} events`);
      return events.length;
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.writer.writeFacilityMetadata(config.id, 'error', 0, errorMessage);
      console.error(`❌ ${config.name} failed after ${duration}s: ${errorMessage}`);
      throw error;
    }
  }

  async scrapeAllWithSummary(): Promise<{ id: string; name: string; status: 'success' | 'error'; eventCount: number; error?: string }[]> {
    const results: { id: string; name: string; status: 'success' | 'error'; eventCount: number; error?: string }[] = [];
    for (const config of SCRAPERS) {
      try {
        const count = await this.scrapeRink(config.id);
        results.push({ id: config.id, name: config.name, status: 'success', eventCount: count });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.push({ id: config.id, name: config.name, status: 'error', eventCount: 0, error: errorMessage });
      }
    }
    return results;
  }
}

// CLI entry point
async function main() {
  // Support both positional and --rink/-r arguments
  const args = process.argv.slice(2);
  let rinkIds: string[] = [];
  if (args.length === 0) {
    rinkIds = [];
  } else if (args[0] === '--rink' || args[0] === '-r') {
    if (args[1]) rinkIds = [args[1]];
  } else if (args[0].startsWith('--rink=')) {
    rinkIds = [args[0].split('=')[1]];
  } else {
    rinkIds = args;
  }
  const orchestrator = new ScraperOrchestrator();
  if (rinkIds.length === 0) {
    // Scrape all and print detailed summary
    const startTime = Date.now();
    const results = await orchestrator.scrapeAllWithSummary();
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    console.log('\n🏁 Full scrape completed in ' + duration + 's:');
    results.forEach(r => {
      if (r.status === 'success') {
        console.log(`   ✅ ${r.name}: ${r.eventCount} events`);
      } else {
        console.log(`   ❌ ${r.name}: FAILED (${r.error})`);
      }
    });
    console.log(`   ✅ Successful: ${successCount}/${SCRAPERS.length}`);
    console.log(`   ❌ Failed: ${errorCount}/${SCRAPERS.length}`);
    console.log('📋 Individual facility data and metadata files updated');
  } else {
    for (const rinkId of rinkIds) {
      await orchestrator.scrapeRink(rinkId);
    }
  }
}

main().catch(err => {
  console.error('❌ Unhandled error in scraper:', err);
  process.exit(1);
});
