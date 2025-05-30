import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { RawIceEventData } from '../../src/types.js';

export interface FacilityMetadata {
  facilityId: string;
  facilityName: string;
  displayName: string;
  lastSuccessfulScrape?: string;
  lastAttempt: string;
  status: 'success' | 'error';
  eventCount: number;
  errorMessage?: string;
  sourceUrl: string;
  rinks: Array<{
    rinkId: string;
    rinkName: string;
  }>;
}

// Legacy metadata structure for backwards compatibility
export interface LegacyRinkMetadata {
  lastSuccessfulScrape?: string;
  lastAttempt: string;
  status: 'success' | 'error';
  eventCount: number;
  errorMessage?: string;
}

export interface LegacyMetadata {
  lastCombinedUpdate: string;
  rinks: Record<string, LegacyRinkMetadata>;
}

// Facility configuration mapping
const FACILITY_CONFIG: Record<string, {
  facilityName: string;
  displayName: string;
  sourceUrl: string;
  rinks: Array<{ rinkId: string; rinkName: string; }>;
}> = {
  'ice-ranch': {
    facilityName: 'The Ice Ranch',
    displayName: 'The Ice Ranch (Littleton)',
    sourceUrl: 'https://www.theiceranch.com/page/show/1652320-calendar',
    rinks: [{ rinkId: 'ice-ranch', rinkName: 'Main Rink' }]
  },
  'big-bear': {
    facilityName: 'Big Bear Ice Arena',
    displayName: 'Big Bear Ice Arena (Denver)',
    sourceUrl: 'https://bigbearicearena.ezfacility.com/Sessions',
    rinks: [{ rinkId: 'big-bear', rinkName: 'Main Rink' }]
  },
  'du-ritchie': {
    facilityName: 'DU Ritchie Center',
    displayName: 'DU Ritchie Center (Denver)',
    sourceUrl: 'https://ritchiecenter.du.edu/sports/ice-programs',
    rinks: [{ rinkId: 'du-ritchie', rinkName: 'Main Rink' }]
  },
  'foothills-edge': {
    facilityName: 'Foothills Edge Ice Arena',
    displayName: 'Foothills Edge Ice Arena (Littleton)',
    sourceUrl: 'https://www.ifoothills.org/cal-edge/',
    rinks: [{ rinkId: 'foothills-edge', rinkName: 'Edge Rink' }]
  },
  'ssprd-249': {
    facilityName: 'Family Sports Center',
    displayName: 'Family Sports Center (Centennial)',
    sourceUrl: 'https://ssprd.finnlyconnect.com/schedule/249',
    rinks: [
      { rinkId: 'fsc-avalanche', rinkName: 'Avalanche Rink' },
      { rinkId: 'fsc-fixit', rinkName: 'FixIt 24/7 Rink' }
    ]
  },
  'ssprd-250': {
    facilityName: 'South Suburban Sports Complex',
    displayName: 'South Suburban Sports Complex (Littleton)',
    sourceUrl: 'https://ssprd.finnlyconnect.com/schedule/250',
    rinks: [
      { rinkId: 'sssc-rink1', rinkName: 'Rink 1' },
      { rinkId: 'sssc-rink2', rinkName: 'Rink 2' },
      { rinkId: 'sssc-rink3', rinkName: 'Rink 3' }
    ]
  }
};

export class DataFileWriter {
  private readonly dataDir = join(process.cwd(), 'public', 'data');
  private readonly combinedFile = join(this.dataDir, 'combined.json');
  private readonly legacyMetadataFile = join(this.dataDir, 'metadata.json');

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

  async writeFacilityMetadata(facilityId: string, status: 'success' | 'error', eventCount: number, errorMessage?: string): Promise<void> {
    await this.ensureDataDir();
    
    const metadataFile = join(this.dataDir, `${facilityId}-metadata.json`);
    const now = new Date().toISOString();
    
    const facilityConfig = FACILITY_CONFIG[facilityId];
    if (!facilityConfig) {
      console.warn(`⚠️ No facility configuration found for ${facilityId}, using defaults`);
    }
    
    const metadata: FacilityMetadata = {
      facilityId,
      facilityName: facilityConfig?.facilityName || facilityId,
      displayName: facilityConfig?.displayName || facilityId,
      lastAttempt: now,
      status,
      eventCount,
      sourceUrl: facilityConfig?.sourceUrl || '',
      rinks: facilityConfig?.rinks || [{ rinkId: facilityId, rinkName: 'Main Rink' }],
      ...(status === 'success' && { lastSuccessfulScrape: now }),
      ...(errorMessage && { errorMessage })
    };
    
    await writeFile(metadataFile, JSON.stringify(metadata, null, 2));
    console.log(`📊 Updated metadata for ${facilityId}: ${status} (${eventCount} events)`);
  }

  // Updated method to use new individual metadata approach
  async updateMetadata(rinkId: string, status: 'success' | 'error', eventCount: number, errorMessage?: string): Promise<void> {
    // Write individual metadata file
    await this.writeFacilityMetadata(rinkId, status, eventCount, errorMessage);
    
    // Also update legacy metadata for backwards compatibility during transition
    await this.updateLegacyMetadata(rinkId, status, eventCount, errorMessage);
  }

  private async updateLegacyMetadata(rinkId: string, status: 'success' | 'error', eventCount: number, errorMessage?: string): Promise<void> {
    await this.ensureDataDir();
    
    let metadata: LegacyMetadata;
    
    // Read existing metadata or create new
    try {
      if (existsSync(this.legacyMetadataFile)) {
        const metadataContent = await readFile(this.legacyMetadataFile, 'utf-8');
        metadata = JSON.parse(metadataContent);
      } else {
        metadata = {
          lastCombinedUpdate: new Date().toISOString(),
          rinks: {}
        };
      }
    } catch (error) {
      console.warn(`⚠️ Error reading legacy metadata, creating new: ${error.message}`);
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
    
    await writeFile(this.legacyMetadataFile, JSON.stringify(metadata, null, 2));
    console.log(`📊 Updated legacy metadata for ${rinkId}: ${status} (${eventCount} events)`);
  }

  async regenerateCombinedFile(): Promise<void> {
    await this.ensureDataDir();
    
    const allEvents: any[] = [];
    // Updated to include foothills-edge.json
    const rinkFiles = [
      'ice-ranch.json', 
      'big-bear.json', 
      'du-ritchie.json', 
      'foothills-edge.json',
      'ssprd-249.json', 
      'ssprd-250.json'
    ];
    
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
    
    // Update legacy metadata timestamp
    try {
      const metadataContent = await readFile(this.legacyMetadataFile, 'utf-8');
      const metadata = JSON.parse(metadataContent);
      metadata.lastCombinedUpdate = new Date().toISOString();
      await writeFile(this.legacyMetadataFile, JSON.stringify(metadata, null, 2));
    } catch (error) {
      console.warn(`⚠️ Error updating combined timestamp: ${error.message}`);
    }
  }

  async readFacilityMetadata(facilityId: string): Promise<FacilityMetadata | null> {
    try {
      const metadataFile = join(this.dataDir, `${facilityId}-metadata.json`);
      if (existsSync(metadataFile)) {
        const content = await readFile(metadataFile, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.warn(`⚠️ Error reading metadata for ${facilityId}: ${error.message}`);
    }
    return null;
  }

  // Legacy method for backwards compatibility
  async readMetadata(): Promise<LegacyMetadata | null> {
    try {
      if (existsSync(this.legacyMetadataFile)) {
        const content = await readFile(this.legacyMetadataFile, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.warn(`⚠️ Error reading legacy metadata: ${error.message}`);
    }
    return null;
  }
}
