#!/usr/bin/env bun

// Test script to verify timezone handling for Ice Ranch events

function parseIceRanchTimeFixed(timeStr: string, baseDate: Date): Date {
  const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*([ap]m)/i);
  if (!timeMatch) return baseDate;
  
  let hours = parseInt(timeMatch[1]);
  const minutes = parseInt(timeMatch[2]);
  const ampm = timeMatch[3].toLowerCase();
  
  // Convert to 24-hour format
  if (ampm === 'pm' && hours !== 12) hours += 12;
  if (ampm === 'am' && hours === 12) hours = 0;
  
  // Create date in Mountain Time, then convert to UTC for storage
  const result = new Date(baseDate);
  
  // Set the time as if it were UTC first
  result.setUTCHours(hours, minutes, 0, 0);
  
  // Then add 6 hours to convert from Mountain Time to UTC
  result.setTime(result.getTime() + (6 * 60 * 60 * 1000));
  
  return result;
}

function parseIceRanchTimeOld(timeStr: string, baseDate: Date): Date {
  const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*([ap]m)/i);
  if (!timeMatch) return baseDate;
  
  let hours = parseInt(timeMatch[1]);
  const minutes = parseInt(timeMatch[2]);
  const ampm = timeMatch[3].toLowerCase();
  
  // Convert to 24-hour format
  if (ampm === 'pm' && hours !== 12) hours += 12;
  if (ampm === 'am' && hours === 12) hours = 0;
  
  // Create new date with the parsed time (OLD - treats as local timezone)
  const result = new Date(baseDate);
  result.setHours(hours, minutes, 0, 0);
  
  return result;
}

async function testTimezoneConversion() {
  console.log('🕐 Testing Ice Ranch Timezone Conversion\n');
  
  const testDate = new Date('2025-05-27'); // Tuesday, May 27, 2025
  const testTimes = [
    '11:15am',
    '12:45pm', 
    '3:15pm',
    '4:45pm'
  ];
  
  console.log('📅 Test Date: Tuesday, May 27, 2025\n');
  
  for (const timeStr of testTimes) {
    console.log(`⏰ Testing: "${timeStr} MDT"`);
    
    // Old method (incorrect)
    const oldResult = parseIceRanchTimeOld(timeStr, testDate);
    console.log(`   ❌ Old method: ${oldResult.toISOString()}`);
    console.log(`   ❌ Displayed in MT: ${oldResult.toLocaleString('en-US', {timeZone: 'America/Denver'})}`);
    
    // New method (correct)
    const newResult = parseIceRanchTimeFixed(timeStr, testDate);
    console.log(`   ✅ New method: ${newResult.toISOString()}`);
    console.log(`   ✅ Displayed in MT: ${newResult.toLocaleString('en-US', {timeZone: 'America/Denver'})}`);
    
    console.log('');
  }
  
  console.log('🎯 Expected Results:');
  console.log('   - Ice Ranch shows: 11:15am MDT, 3:15pm MDT');
  console.log('   - Our app should show: 11:15 AM, 3:15 PM (in Mountain Time)');
  console.log('   - Stored as UTC: 5:15 PM, 9:15 PM');
}

await testTimezoneConversion();

