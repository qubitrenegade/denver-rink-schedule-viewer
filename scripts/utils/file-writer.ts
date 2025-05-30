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

  // Get list of all available facility IDs
  async getAvailableFacilities(): Promise<string[]> {
    await this.ensureDataDir();
    return Object.keys(FACILITY_CONFIG);
  }

  // Get all facility metadata
  async getAllFacilityMetadata(): Promise<Record<string, FacilityMetadata>> {
    const facilities = await this.getAvailableFacilities();
    const metadata: Record<string, FacilityMetadata> = {};
    
    for (const facilityId of facilities) {
      const facilityMeta = await this.readFacilityMetadata(facilityId);
      if (facilityMeta) {
        metadata[facilityId] = facilityMeta;
      }
    }
    
    return metadata;
  }
}
