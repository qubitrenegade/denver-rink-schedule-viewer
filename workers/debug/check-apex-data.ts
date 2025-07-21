/**
 * Debug script to check what's actually stored in KV for Apex events
 */

// Mock what the current data might look like in KV
const mockStoredApexEvent = {
  id: 'apex-ice-west-12345',
  rinkId: 'apex-ice-west',
  title: 'Free Style/Figure Skating',
  startTime: '2024-07-15T05:30:00.000Z', // This is WRONG - should be 11:30 UTC for 5:30 AM MDT
  endTime: '2024-07-15T06:30:00.000Z',   // This is WRONG - should be 12:30 UTC for 6:30 AM MDT
  category: 'Figure Skating'
};

const correctApexEvent = {
  id: 'apex-ice-west-12345',
  rinkId: 'apex-ice-west', 
  title: 'Free Style/Figure Skating',
  startTime: '2024-07-15T11:30:00.000Z', // CORRECT - 5:30 AM MDT = 11:30 UTC
  endTime: '2024-07-15T12:30:00.000Z',   // CORRECT - 6:30 AM MDT = 12:30 UTC
  category: 'Figure Skating'
};

console.log('=== APEX DATA ANALYSIS ===');

// Simulate what the frontend does
console.log('\n1. What frontend sees with WRONG stored data:');
const wrongStartTime = new Date(mockStoredApexEvent.startTime);
const wrongEndTime = new Date(mockStoredApexEvent.endTime);
console.log('Browser shows:', wrongStartTime.toLocaleTimeString(), '-', wrongEndTime.toLocaleTimeString());
console.log('In MDT that would be:', wrongStartTime.toLocaleTimeString('en-US', {timeZone: 'America/Denver'}));

console.log('\n2. What frontend should see with CORRECT stored data:');
const correctStartTime = new Date(correctApexEvent.startTime);
const correctEndTime = new Date(correctApexEvent.endTime);
console.log('Browser shows:', correctStartTime.toLocaleTimeString(), '-', correctEndTime.toLocaleTimeString());
console.log('In MDT that would be:', correctStartTime.toLocaleTimeString('en-US', {timeZone: 'America/Denver'}));

console.log('\n3. How to fix this:');
console.log('Need to re-scrape Apex data with the corrected timezone conversion');
console.log('The scraper fix prevents future bad data, but existing KV data is still wrong');

export {};