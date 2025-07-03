/**
 * Tests for Colorado timezone utilities
 */
import { ColoradoTimezone } from './timezone-utils';

// Test DST boundaries for 2024
describe('ColoradoTimezone', () => {
  test('correctly identifies DST periods', () => {
    // March 10, 2024 - DST starts (second Sunday in March)
    const dstStart = new Date('2024-03-10T02:00:00');
    const beforeDST = new Date('2024-03-09T23:00:00');
    const afterDST = new Date('2024-03-10T03:00:00');
    
    expect(ColoradoTimezone.isDST(beforeDST)).toBe(false);
    expect(ColoradoTimezone.isDST(dstStart)).toBe(true);
    expect(ColoradoTimezone.isDST(afterDST)).toBe(true);
    
    // November 3, 2024 - DST ends (first Sunday in November)
    const dstEnd = new Date('2024-11-03T02:00:00');
    const beforeDSTEnd = new Date('2024-11-02T23:00:00');
    const afterDSTEnd = new Date('2024-11-03T03:00:00');
    
    expect(ColoradoTimezone.isDST(beforeDSTEnd)).toBe(true);
    expect(ColoradoTimezone.isDST(dstEnd)).toBe(false);
    expect(ColoradoTimezone.isDST(afterDSTEnd)).toBe(false);
  });
  
  test('returns correct UTC offsets', () => {
    // Summer (MDT) - UTC-6
    const summer = new Date('2024-07-15T12:00:00');
    expect(ColoradoTimezone.getUTCOffset(summer)).toBe(-6);
    
    // Winter (MST) - UTC-7  
    const winter = new Date('2024-01-15T12:00:00');
    expect(ColoradoTimezone.getUTCOffset(winter)).toBe(-7);
  });
  
  test('converts Mountain Time to UTC correctly', () => {
    // Summer: 12:00 PM MDT = 6:00 PM UTC
    const summerLocal = new Date('2024-07-15T12:00:00');
    const summerUTC = ColoradoTimezone.mountainTimeToUTC(summerLocal);
    expect(summerUTC.getUTCHours()).toBe(18); // 12 + 6 = 18
    
    // Winter: 12:00 PM MST = 7:00 PM UTC
    const winterLocal = new Date('2024-01-15T12:00:00');
    const winterUTC = ColoradoTimezone.mountainTimeToUTC(winterLocal);
    expect(winterUTC.getUTCHours()).toBe(19); // 12 + 7 = 19
  });
  
  test('parseMountainTime handles different formats', () => {
    const baseDate = new Date('2024-07-15');
    
    // Test time-only parsing
    const result1 = ColoradoTimezone.parseMountainTime('2:30 PM', baseDate);
    expect(result1.getUTCHours()).toBe(20); // 2:30 PM MDT = 8:30 PM UTC
    expect(result1.getUTCMinutes()).toBe(30);
    
    // Test full datetime without timezone (should assume Mountain Time)
    const result2 = ColoradoTimezone.parseMountainTime('2024-07-15T14:30:00');
    expect(result2.getUTCHours()).toBe(20); // 2:30 PM MDT = 8:30 PM UTC
  });
});