#!/usr/bin/env bun

// Quick script to check timezone handling across different scrapers
import { readFile } from 'fs/promises';
import { join } from 'path';

async function debugTimezones() {
  console.log('🕐 Debugging Timezone Storage Across Scrapers');
  console.log('==============================================');
  
  const dataDir = join(process.cwd(), 'public', 'data');
  const files = [
    'ice-ranch.json',
    'big-bear.json', 
    'du-ritchie.json',
    'foothills-edge.json',
    'ssprd-249.json'
  ];
  
  for (const file of files) {
    try {
      const filePath = join(dataDir, file);
      const content = await readFile(filePath, 'utf-8');
      const events = JSON.parse(content);
      
      if (events.length > 0) {
        const sampleEvent = events[0];
        const startTime = new Date(sampleEvent.startTime);
        
        console.log(`\n📁 ${file}:`);
        console.log(`   Sample Event: "${sampleEvent.title}"`);
        console.log(`   Raw UTC String: ${sampleEvent.startTime}`);
        console.log(`   Parsed Date: ${startTime.toString()}`); 
        console.log(`   Display (no TZ): ${startTime.toLocaleTimeString()}`);
        console.log(`   Display (MT): ${startTime.toLocaleTimeString('en-US', {timeZone: 'America/Denver'})}`);
        console.log(`   Display (UTC): ${startTime.toLocaleTimeString('en-US', {timeZone: 'UTC'})}`);
        
        // Check if it looks like the stored time is correct
        const expectedMTTime = startTime.toLocaleTimeString('en-US', {timeZone: 'America/Denver'});
        const actualDisplayTime = startTime.toLocaleTimeString();
        
        if (expectedMTTime === actualDisplayTime) {
          console.log(`   ✅ Timezone appears CORRECT (MT time matches display)`);
        } else {
          console.log(`   ❌ Timezone appears WRONG (${expectedMTTime} MT != ${actualDisplayTime} display)`);
        }
      }
    } catch (error) {
      console.log(`\n❌ Error reading ${file}: ${error.message}`);
    }
  }
  
  console.log('\n🎯 Expected Behavior:');
  console.log('   - 6:00 AM MT event should be stored as 12:00 PM UTC');
  console.log('   - When displayed, should show as 6:00 AM (local time)');
  console.log('   - If your local timezone is MT, no explicit timeZone needed');
  console.log('   - If stored incorrectly, will need scraper fixes');
}

await debugTimezones();
