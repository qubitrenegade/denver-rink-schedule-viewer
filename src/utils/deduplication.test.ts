// src/utils/deduplication.test.ts - Test deduplication logic directly

import { describe, it, expect } from 'vitest';
import { RawIceEventData, EventCategory } from '../types';

// Direct implementation of the deduplication logic for testing
function deduplicateEvents(events: RawIceEventData[]): RawIceEventData[] {
  return events.filter((event, index, self) =>
    index === self.findIndex((e) =>
      e.title === event.title &&
      e.startTime.getTime() === event.startTime.getTime()
    )
  );
}

describe('Event Deduplication Logic', () => {
  const createTestEvent = (
    id: string, 
    title: string, 
    rinkId: string, 
    timeOffset: number = 0
  ): RawIceEventData => {
    const baseTime = new Date('2025-01-02T14:30:00.000Z');
    const startTime = new Date(baseTime.getTime() + timeOffset);
    const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000);

    return {
      id,
      rinkId,
      title,
      startTime,
      endTime,
      category: 'Public Skate' as EventCategory,
      description: `Description for ${title}`
    };
  };

  it('should remove exact duplicates (same title and startTime)', () => {
    const events: RawIceEventData[] = [
      createTestEvent('1', 'Public Skate', 'rink-a'),
      createTestEvent('2', 'Public Skate', 'rink-b'), // Same title, same time, different rink
      createTestEvent('3', 'Hockey Practice', 'rink-a')
    ];

    const result = deduplicateEvents(events);

    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('Public Skate');
    expect(result[0].rinkId).toBe('rink-a'); // First occurrence kept
    expect(result[1].title).toBe('Hockey Practice');
  });

  it('should keep events with same title but different times', () => {
    const events: RawIceEventData[] = [
      createTestEvent('1', 'Public Skate', 'rink-a', 0),                    // 14:30
      createTestEvent('2', 'Public Skate', 'rink-a', 2 * 60 * 60 * 1000), // 16:30
      createTestEvent('3', 'Public Skate', 'rink-b', 4 * 60 * 60 * 1000)  // 18:30
    ];

    const result = deduplicateEvents(events);

    expect(result).toHaveLength(3);
    expect(result.every(e => e.title === 'Public Skate')).toBe(true);
    
    // All should have different start times
    const startTimes = result.map(e => e.startTime.getTime());
    expect(new Set(startTimes).size).toBe(3);
  });

  it('should keep events with different titles but same time', () => {
    const events: RawIceEventData[] = [
      createTestEvent('1', 'Public Skate', 'rink-a'),
      createTestEvent('2', 'Hockey Practice', 'rink-a'),
      createTestEvent('3', 'Figure Skating', 'rink-b')
    ];

    const result = deduplicateEvents(events);

    expect(result).toHaveLength(3);
    
    const titles = result.map(e => e.title);
    expect(titles).toContain('Public Skate');
    expect(titles).toContain('Hockey Practice');
    expect(titles).toContain('Figure Skating');
  });

  it('should handle multiple duplicate groups', () => {
    const events: RawIceEventData[] = [
      // Group 1: Public Skate at 14:30 (3 duplicates)
      createTestEvent('1', 'Public Skate', 'rink-a', 0),
      createTestEvent('2', 'Public Skate', 'rink-b', 0),
      createTestEvent('3', 'Public Skate', 'rink-c', 0),
      
      // Group 2: Hockey Practice at 16:30 (2 duplicates)
      createTestEvent('4', 'Hockey Practice', 'rink-a', 2 * 60 * 60 * 1000),
      createTestEvent('5', 'Hockey Practice', 'rink-b', 2 * 60 * 60 * 1000),
      
      // Unique event
      createTestEvent('6', 'Figure Skating', 'rink-a', 4 * 60 * 60 * 1000)
    ];

    const result = deduplicateEvents(events);

    expect(result).toHaveLength(3);
    
    const titles = result.map(e => e.title);
    expect(titles).toContain('Public Skate');
    expect(titles).toContain('Hockey Practice');
    expect(titles).toContain('Figure Skating');
    
    // Verify first occurrence was kept
    const publicSkateEvent = result.find(e => e.title === 'Public Skate');
    const hockeyEvent = result.find(e => e.title === 'Hockey Practice');
    
    expect(publicSkateEvent?.rinkId).toBe('rink-a');
    expect(hockeyEvent?.rinkId).toBe('rink-a');
  });

  it('should preserve order of first occurrences', () => {
    const events: RawIceEventData[] = [
      createTestEvent('1', 'Event A', 'rink-a', 0),                    // 14:30
      createTestEvent('2', 'Event B', 'rink-a', 1 * 60 * 60 * 1000), // 15:30
      createTestEvent('3', 'Event A', 'rink-b', 0),                   // 14:30 (duplicate)
      createTestEvent('4', 'Event C', 'rink-a', 3 * 60 * 60 * 1000)  // 17:30
    ];

    const result = deduplicateEvents(events);

    expect(result).toHaveLength(3);
    
    // Should keep original order of first occurrences
    expect(result[0].title).toBe('Event A');
    expect(result[0].id).toBe('1'); // First occurrence
    expect(result[1].title).toBe('Event B');
    expect(result[2].title).toBe('Event C');
  });

  it('should handle empty array', () => {
    const result = deduplicateEvents([]);
    expect(result).toHaveLength(0);
  });

  it('should handle array with no duplicates', () => {
    const events: RawIceEventData[] = [
      createTestEvent('1', 'Event A', 'rink-a', 0),
      createTestEvent('2', 'Event B', 'rink-a', 1 * 60 * 60 * 1000),
      createTestEvent('3', 'Event C', 'rink-b', 2 * 60 * 60 * 1000)
    ];

    const result = deduplicateEvents(events);

    expect(result).toHaveLength(3);
    expect(result).toEqual(events);
  });

  it('should handle case-sensitive title matching', () => {
    const events: RawIceEventData[] = [
      createTestEvent('1', 'Public Skate', 'rink-a'),
      createTestEvent('2', 'public skate', 'rink-a'), // Different case
      createTestEvent('3', 'PUBLIC SKATE', 'rink-a')  // Different case
    ];

    const result = deduplicateEvents(events);

    // Should keep all 3 because titles are different (case-sensitive)
    expect(result).toHaveLength(3);
  });
});