/**
 * Tests for Apex Ice Arena scraper timezone handling
 */
import { describe, test, expect } from 'vitest';
import { ColoradoTimezone } from '../shared/timezone-utils';

// Mock event data from Apex API
const mockApexEvent = {
  title: 'Freestyle/Figure Skating',
  start_time: '2024-07-15 05:30:00', // 5:30 AM MDT (summer)
  end_time: '2024-07-15 06:30:00',   // 6:30 AM MDT (summer)
  event_item_id: '12345',
  facilities: [{
    facility_name: 'West Rink'
  }]
};

describe('Apex Ice scraper timezone conversion', () => {
  test('simulates the exact Apex scraper flow', () => {
    // Simulate what the Apex scraper actually does
    const event = mockApexEvent;
    
    // OLD (buggy) approach - what was causing midnight times
    const oldStartDate = new Date(event.start_time); // This treats it as local time!
    const oldUtc = ColoradoTimezone.mountainTimeToUTC(oldStartDate);
    
    // NEW (fixed) approach - what we just changed to
    const newUtc = ColoradoTimezone.parseMountainTime(event.start_time);
    
    console.log('Original time string:', event.start_time);
    console.log('System timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);
    console.log('OLD approach (new Date + mountainTimeToUTC):', oldUtc.toISOString());
    console.log('NEW approach (parseMountainTime):', newUtc.toISOString());
    
    // Test the NEW approach is correct
    // 5:30 AM MDT (UTC-6) should be 11:30 AM UTC
    expect(newUtc.getUTCHours()).toBe(11);
    expect(newUtc.getUTCMinutes()).toBe(30);
    
    // The issue was likely that in production, the server is running in UTC timezone
    // So new Date('2024-07-15 05:30:00') was being interpreted as UTC, not local
    // Then mountainTimeToUTC was adding ANOTHER 6 hours, giving wrong result
  });
  
  test('ColoradoTimezone.parseMountainTime handles datetime strings correctly', () => {
    // Test our utility function with the apex format
    const result = ColoradoTimezone.parseMountainTime('2024-07-15 05:30:00');
    
    console.log('Parsed result:', result.toISOString());
    
    // 5:30 AM MDT should convert to 11:30 AM UTC in summer
    expect(result.getUTCHours()).toBe(11);
    expect(result.getUTCMinutes()).toBe(30);
  });
  
  test('handles winter time correctly (MST)', () => {
    // Test winter time (MST = UTC-7)
    const winterResult = ColoradoTimezone.parseMountainTime('2024-01-15 05:30:00');
    
    console.log('Winter result:', winterResult.toISOString());
    
    // 5:30 AM MST should convert to 12:30 PM UTC in winter
    expect(winterResult.getUTCHours()).toBe(12);
    expect(winterResult.getUTCMinutes()).toBe(30);
  });
  
  test('prevents midnight time display bug', () => {
    // This test ensures we don't get times like "12:45 AM - 1:45 AM" 
    // when the actual event is at "5:30 AM - 6:30 AM" MDT
    
    const event = {
      start_time: '2024-07-15 05:30:00', // 5:30 AM MDT
      end_time: '2024-07-15 06:30:00'    // 6:30 AM MDT
    };
    
    // Use the fixed parsing
    const startUtc = ColoradoTimezone.parseMountainTime(event.start_time);
    const endUtc = ColoradoTimezone.parseMountainTime(event.end_time);
    
    // Convert back to Mountain Time for display verification
    const startMT = new Date(startUtc.getTime() - (6 * 60 * 60 * 1000)); // UTC-6 for MDT
    const endMT = new Date(endUtc.getTime() - (6 * 60 * 60 * 1000));
    
    console.log('UTC times:', startUtc.toISOString(), endUtc.toISOString());
    console.log('MT display times:', startMT.toLocaleTimeString(), endMT.toLocaleTimeString());
    
    // Verify UTC times are correct (11:30 UTC for 5:30 AM MDT)
    expect(startUtc.getUTCHours()).toBe(11);
    expect(startUtc.getUTCMinutes()).toBe(30);
    expect(endUtc.getUTCHours()).toBe(12);
    expect(endUtc.getUTCMinutes()).toBe(30);
    
    // When displayed in MT, should NOT be midnight hours
    expect(startMT.getHours()).toBe(5);
    expect(endMT.getHours()).toBe(6);
  });
});