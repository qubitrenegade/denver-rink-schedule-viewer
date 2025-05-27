import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { RawIceEventData } from '../../src/types.js';

export interface RinkMetadata {
  lastSuccessfulScrape?: string;
  lastAttempt: string;
  status: 'success' | 'error';
  eventCount: number;
  errorMessage?: string;
}

export interface Metadata {
  lastCombinedUpdate: string;
  rinks: Record<string, RinkMetadata>;
}

export class DataFileWriter {
  private readonly dataDir = join(process.cwd(), 'data');
  private readonly combinedFile = join(this.dataDir, 'combined.json');
  private readonly metadataFile = join(this.dataDir, 'metadata.json');

  async ensureDataDir(): Promise<void> {
    if (!existsSync(this.dataDir)) {
      await mkdir(this.dataDir, { recursive: true });
      console.log(`📁 Created data directory: ${this.dataDir}`);
    }
  }

  async writeRinkData(rinkId: string, events: RawIceEventData[]): Promise<void> {
    await this.ensureDataDir();
    
    const rinkFile = join(this.dataDir, `${rinkId}.json`);
    
    // Convert dates to ISO strings for JSON serialization
    const serializedEvents = events.map(event => ({
      ...event,
      startTime: event.startTime.toISOString(),
      endTime: event.endTime.toISOString(),
    }));
    
    await writeFile(rinkFile, JSON.stringify(serializedEvents, null, 2));
    console.log(`💾 Wrote ${events.length} events to ${rinkFile}`);
  }

  async updateMetadata(rinkId: string, status: 'success' | 'error', eventCount: number, errorMessage?: string): Promise<void> {
    await this.ensureDataDir();
    
    let metadata: Metadata;
    
    // Read existing metadata or create new
    try {
      if (existsSync(this.metadataFile)) {
        const metadataContent = await readFile(this.metadataFile, 'utf-8');
        metadata = JSON.parse(metadataContent);
      } else {
        metadata = {
          lastCombinedUpdate: new Date().toISOString(),
          rinks: {}
        };
      }
    } catch (error) {
      console.warn(`⚠️ Error reading metadata, creating new: ${error.message}`);
      metadata = {
        lastCombinedUpdate: new Date().toISOString(),
        rinks: {}
      };
    }
    
    // Update this rink's metadata
    const now = new Date().toISOString();
    metadata.rinks[rinkId] = {
      lastAttempt: now,
      status,
      eventCount,
      ...(status === 'success' && { lastSuccessfulScrape: now }),
      ...(errorMessage && { errorMessage })
    };
    
    await writeFile(this.metadataFile, JSON.stringify(metadata, null, 2));
    console.log(`📊 Updated metadata for ${rinkId}: ${status} (${eventCount} events)`);
  }

  async regenerateCombinedFile(): Promise<void> {
    await this.ensureDataDir();
    
    const allEvents: any[] = [];
    const rinkFiles = ['ice-ranch.json', 'big-bear.json', 'ssprd-249.json', 'ssprd-250.json'];
    
    for (const rinkFile of rinkFiles) {
      const filePath = join(this.dataDir, rinkFile);
      if (existsSync(filePath)) {
        try {
          const content = await readFile(filePath, 'utf-8');
          const events = JSON.parse(content);
          allEvents.push(...events);
          console.log(`📋 Added ${events.length} events from ${rinkFile}`);
        } catch (error) {
          console.warn(`⚠️ Error reading ${rinkFile}: ${error.message}`);
        }
      }
    }
    
    // Sort by start time
    allEvents.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    
    await writeFile(this.combinedFile, JSON.stringify(allEvents, null, 2));
    console.log(`✅ Combined file updated with ${allEvents.length} total events`);
    
    // Update metadata
    try {
      const metadataContent = await readFile(this.metadataFile, 'utf-8');
      const metadata = JSON.parse(metadataContent);
      metadata.lastCombinedUpdate = new Date().toISOString();
      await writeFile(this.metadataFile, JSON.stringify(metadata, null, 2));
    } catch (error) {
      console.warn(`⚠️ Error updating combined timestamp: ${error.message}`);
    }
  }

  async readMetadata(): Promise<Metadata | null> {
    try {
      if (existsSync(this.metadataFile)) {
        const content = await readFile(this.metadataFile, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.warn(`⚠️ Error reading metadata: ${error.message}`);
    }
    return null;
  }
}

