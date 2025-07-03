/**
 * Migration script to fix Apex timezone data in KV storage
 * This fixes existing data that was incorrectly converted
 */
import { ColoradoTimezone } from '../shared/timezone-utils';

interface StoredEvent {
  id: string;
  rinkId: string;
  title: string;
  startTime: string;
  endTime: string;
  category: string;
  description?: string;
  eventUrl?: string;
}

// This would be called as part of a migration worker
export async function migrateApexEvents(kvNamespace: KVNamespace): Promise<void> {
  console.log('🔄 Starting Apex timezone migration...');
  
  const apexRinks = ['apex-ice-east', 'apex-ice-west'];
  let totalFixed = 0;
  
  for (const rinkId of apexRinks) {
    try {
      // Get existing events
      const eventsData = await kvNamespace.get(`events:${rinkId}`);
      if (!eventsData) {
        console.log(`⚠️ No data found for ${rinkId}`);
        continue;
      }
      
      const events: StoredEvent[] = JSON.parse(eventsData);
      console.log(`📊 Processing ${events.length} events for ${rinkId}`);
      
      // Fix each event's timezone
      const fixedEvents = events.map(event => {
        const originalStart = new Date(event.startTime);
        const originalEnd = new Date(event.endTime);
        
        // If the stored time looks like it's been incorrectly converted
        // (i.e., it's storing local time as UTC), we need to re-convert it
        
        // Detect if this is bad data: check if the UTC time when displayed 
        // in Mountain Time shows weird hours (like midnight for morning events)
        const mtStart = new Date(originalStart.toLocaleString("en-US", {timeZone: "America/Denver"}));
        const isLikelyBadData = mtStart.getHours() < 5 || mtStart.getHours() > 23;
        
        if (isLikelyBadData) {
          // This is probably incorrect data - need to fix it
          // Assume the stored time is actually Mountain Time stored as UTC
          const fixedStart = ColoradoTimezone.mountainTimeToUTC(originalStart);
          const fixedEnd = ColoradoTimezone.mountainTimeToUTC(originalEnd);
          
          console.log(`🔧 Fixing ${event.title}:`);
          console.log(`   Original: ${originalStart.toISOString()} → ${fixedStart.toISOString()}`);
          
          return {
            ...event,
            startTime: fixedStart.toISOString(),
            endTime: fixedEnd.toISOString()
          };
        }
        
        return event; // No change needed
      });
      
      // Count how many were actually changed
      const changedEvents = fixedEvents.filter((event, i) => 
        event.startTime !== events[i].startTime
      );
      
      if (changedEvents.length > 0) {
        console.log(`✅ Fixed ${changedEvents.length} events for ${rinkId}`);
        
        // Store the corrected data back to KV
        await kvNamespace.put(`events:${rinkId}`, JSON.stringify(fixedEvents));
        totalFixed += changedEvents.length;
      } else {
        console.log(`✅ No corrections needed for ${rinkId}`);
      }
      
    } catch (error) {
      console.error(`❌ Error migrating ${rinkId}:`, error);
    }
  }
  
  console.log(`🎉 Migration complete! Fixed ${totalFixed} total events.`);
}

// Test function to simulate the migration
export function testMigration() {
  console.log('🧪 Testing migration logic...');
  
  const badEvent: StoredEvent = {
    id: 'test',
    rinkId: 'apex-ice-west',
    title: 'Early Morning Skate',
    startTime: '2024-07-15T05:30:00.000Z', // Bad: 5:30 UTC displays as 11:30 PM MDT
    endTime: '2024-07-15T06:30:00.000Z',   // Bad: 6:30 UTC displays as 12:30 AM MDT
    category: 'Public Skate'
  };
  
  const originalStart = new Date(badEvent.startTime);
  console.log('Original stored time (UTC):', originalStart.toISOString());
  console.log('Displays in browser as MDT:', originalStart.toLocaleString("en-US", {timeZone: "America/Denver"}));
  
  // Apply fix
  const fixedStart = ColoradoTimezone.mountainTimeToUTC(originalStart);
  console.log('Fixed time (UTC):', fixedStart.toISOString());
  console.log('Now displays in browser as MDT:', fixedStart.toLocaleString("en-US", {timeZone: "America/Denver"}));
}

if (import.meta.main) {
  testMigration();
}