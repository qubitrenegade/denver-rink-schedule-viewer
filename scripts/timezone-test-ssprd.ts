#!/usr/bin/env bun

// Test script to verify SSPRD timezone handling

function parseSSPRDDateTimeFixed(dateTimeStr: string): Date {
  const date = new Date(dateTimeStr);
  
  if (isNaN(date.getTime())) {
    console.warn(`   ⚠️ Invalid date format: ${dateTimeStr}`);
    return new Date();
  }
  
  // Check if the date string includes timezone info
  const hasTimezone = /[+-]\d{2}:?\d{2}|Z|UTC|GMT|[A-Z]{3,4}T?$/i.test(dateTimeStr);
  
  if (!hasTimezone) {
    // No timezone info, assume it's Mountain Time and convert to UTC
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();
    const milliseconds = date.getMilliseconds();
    
    // Create a UTC date with these components, then add 6 hours
    const utcDate = new Date(Date.UTC(year, month, day, hours, minutes, seconds, milliseconds));
    utcDate.setTime(utcDate.getTime() + (6 * 60 * 60 * 1000)); // Add 6 hours for MDT->UTC
    
    return utcDate;
  } else {
    // Timezone info included, use as-is
    return date;
  }
}

function parseSSPRDDateTimeOld(dateTimeStr: string): Date {
  return new Date(dateTimeStr);
}

async function testSSPRDTimezones() {
  console.log('🏢 Testing SSPRD Timezone Conversion\n');
  
  // Common SSPRD datetime formats (examples)
  const testDateTimes = [
    '2025-05-28T10:00:00',        // No timezone (assume MT)
    '2025-05-28T14:30:00',        // No timezone (assume MT) 
    '2025-05-28T19:00:00',        // No timezone (assume MT)
    '2025-05-28T10:00:00Z',       // With UTC timezone
    '2025-05-28T10:00:00-06:00',  // With explicit MDT timezone
  ];
  
  for (const dateTimeStr of testDateTimes) {
    console.log(`⏰ Testing: "${dateTimeStr}"`);
    
    // Old method
    const oldResult = parseSSPRDDateTimeOld(dateTimeStr);
    console.log(`   ❌ Old: ${oldResult.toISOString()}`);
    console.log(`   ❌ Displayed in MT: ${oldResult.toLocaleString('en-US', {timeZone: 'America/Denver'})}`);
    
    // New method
    const newResult = parseSSPRDDateTimeFixed(dateTimeStr);
    console.log(`   ✅ New: ${newResult.toISOString()}`);
    console.log(`   ✅ Displayed in MT: ${newResult.toLocaleString('en-US', {timeZone: 'America/Denver'})}`);
    
    console.log('');
  }
  
  console.log('🎯 Expected Behavior:');
  console.log('   - SSPRD times without timezone should be treated as Mountain Time');
  console.log('   - Times with timezone info should be used as-is');
  console.log('   - Final display should show correct Mountain Time to users');
}

await testSSPRDTimezones();
