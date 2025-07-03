#!/usr/bin/env node
/**
 * Script to trigger re-scraping of Apex data with corrected timezone handling
 * Run this to fix the midnight time display bug
 */

const APEX_SCRAPER_URL = process.env.APEX_SCRAPER_URL || 'https://rink-scraper-apex-ice.qbrd.workers.dev';

async function triggerApexRescrape() {
  console.log('🔄 Triggering Apex Ice Arena re-scrape with fixed timezone handling...');
  
  try {
    const response = await fetch(APEX_SCRAPER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Denver-Rink-Schedule-Timezone-Fix/1.0'
      }
    });
    
    if (response.ok) {
      const result = await response.text();
      console.log('✅ Apex re-scrape triggered successfully!');
      console.log('Response:', result);
      console.log('\n🕐 The fixed timezone conversion should now be in effect.');
      console.log('💡 Check the app in a few minutes to see corrected times.');
    } else {
      console.error('❌ Failed to trigger re-scrape:', response.status, response.statusText);
      console.log('💡 You may need to manually trigger the scraper or wait for the next scheduled run.');
    }
  } catch (error) {
    console.error('❌ Error triggering re-scrape:', error.message);
    console.log('\n🔧 Alternative approaches:');
    console.log('1. Wait for the next scheduled scraper run (every 6 hours)');
    console.log('2. Manually trigger via the Cloudflare Workers dashboard');
    console.log('3. Use the scheduler trigger endpoint');
  }
}

// Also provide a local test of the timezone conversion
function testTimezoneConversion() {
  console.log('\n🧪 Testing timezone conversion logic:');
  
  // Simulate what Apex API returns
  const apexApiTime = '2024-07-15 05:30:00'; // 5:30 AM local time
  console.log('Apex API returns:', apexApiTime);
  
  // OLD (buggy) approach
  const oldDate = new Date(apexApiTime);
  console.log('OLD approach result (UTC):', oldDate.toISOString());
  console.log('OLD displays as:', oldDate.toLocaleTimeString());
  
  // NEW (fixed) approach - manually convert
  const newDate = new Date(apexApiTime + ' MST'); // Treat as Mountain Time
  console.log('NEW approach result (UTC):', newDate.toISOString());
  console.log('NEW displays as:', newDate.toLocaleTimeString());
  
  // In Mountain Time
  console.log('Should display in MT as:', newDate.toLocaleString('en-US', {timeZone: 'America/Denver'}));
}

async function main() {
  console.log('🏒 Denver Rink Schedule - Apex Timezone Fix\n');
  
  testTimezoneConversion();
  
  if (process.argv.includes('--trigger')) {
    await triggerApexRescrape();
  } else {
    console.log('\n💡 To trigger a re-scrape, run: node scripts/fix-apex-timezone.js --trigger');
  }
}

main().catch(console.error);