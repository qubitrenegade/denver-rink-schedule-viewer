// workers/shared/regex-patterns.test.ts - Tests for shared regex patterns

import { describe, it, expect } from 'vitest';
import { 
  TIME_PATTERNS, 
  DATE_PATTERNS, 
  HTML_PATTERNS, 
  CONTENT_EXTRACTION, 
  VALIDATION_PATTERNS, 
  RegexHelpers 
} from './regex-patterns';

describe('TIME_PATTERNS', () => {
  describe('TIME_12_HOUR', () => {
    it('should match standard 12-hour time formats', () => {
      const validTimes = [
        '2:30 PM',
        '12:00 AM',
        '11:59 PM',
        '1:00am',
        '3:45p.m.',
        '9:15 A.M.'
      ];

      validTimes.forEach(time => {
        expect(TIME_PATTERNS.TIME_12_HOUR.test(time)).toBe(true);
      });
    });

    it('should extract correct time components', () => {
      const result = '2:30 PM'.match(TIME_PATTERNS.TIME_12_HOUR);
      expect(result).toBeTruthy();
      expect(result![1]).toBe('2');  // hours
      expect(result![2]).toBe('30'); // minutes
      expect(result![3]).toBe('P');  // AM/PM
    });

    it('should not match clearly invalid time formats', () => {
      const invalidTimes = [
        '14:30',     // 24-hour format without AM/PM
        'noon',      // Word
        '2:30',      // Missing AM/PM
        'abc:def PM' // Non-numeric
      ];

      invalidTimes.forEach(time => {
        expect(TIME_PATTERNS.TIME_12_HOUR.test(time), `${time} should not match`).toBe(false);
      });
    });

    it('should match invalid times that have correct structure', () => {
      // Note: The regex pattern matches structure, not logical validity
      // Validation happens in RegexHelpers.parse12HourTime()
      const structurallyValidTimes = [
        '25:00 PM',  // Invalid hour but correct structure
        '2:60 AM'    // Invalid minute but correct structure
      ];

      structurallyValidTimes.forEach(time => {
        expect(TIME_PATTERNS.TIME_12_HOUR.test(time)).toBe(true);
        // But the helper should reject them
        expect(RegexHelpers.parse12HourTime(time)).toBeNull();
      });
    });

    it('should match time without AM/PM as part of longer string', () => {
      // The pattern should match within longer strings, even if missing AM/PM
      expect(TIME_PATTERNS.TIME_12_HOUR.test('2:30')).toBe(false); // No AM/PM
      expect(TIME_PATTERNS.TIME_12_HOUR.test('Event at 2:30 PM today')).toBe(true);
    });
  });

  describe('TIME_RANGE', () => {
    it('should match time range patterns from Ice Ranch', () => {
      const validRanges = [
        'Time: 2:30pm - 4:00pm',
        'Time: 10:00am - 11:30am',
        'Time: 6:45 pm - 8:15pm'
      ];

      validRanges.forEach(range => {
        expect(TIME_PATTERNS.TIME_RANGE.test(range)).toBe(true);
      });
    });

    it('should extract start and end times', () => {
      const result = 'Time: 2:30pm - 4:00pm'.match(TIME_PATTERNS.TIME_RANGE);
      expect(result).toBeTruthy();
      expect(result![1].trim()).toBe('2:30pm');
      expect(result![2]).toBe('4:00pm');
    });
  });
});

describe('DATE_PATTERNS', () => {
  describe('ISO_DATE', () => {
    it('should match ISO date format', () => {
      expect(DATE_PATTERNS.ISO_DATE.test('2025-01-02')).toBe(true);
      expect(DATE_PATTERNS.ISO_DATE.test('2025-12-31')).toBe(true);
    });

    it('should not match invalid ISO dates', () => {
      expect(DATE_PATTERNS.ISO_DATE.test('25-01-02')).toBe(false);
      expect(DATE_PATTERNS.ISO_DATE.test('2025-1-2')).toBe(false);
      expect(DATE_PATTERNS.ISO_DATE.test('January 2, 2025')).toBe(false);
    });
  });

  describe('DATE_WITH_DAY', () => {
    it('should match date with day prefix from Ice Ranch', () => {
      const validDates = [
        'Monday January 2, 2025: ',
        'Wednesday December 31, 2024: ',
        'Friday July 4, 2025: '
      ];

      validDates.forEach(date => {
        expect(DATE_PATTERNS.DATE_WITH_DAY.test(date)).toBe(true);
      });
    });
  });
});

describe('HTML_PATTERNS', () => {
  describe('HTML_TAGS', () => {
    it('should match and remove HTML tags', () => {
      const htmlText = '<p>Hello <strong>World</strong></p>';
      const cleanText = htmlText.replace(HTML_PATTERNS.HTML_TAGS, '');
      expect(cleanText).toBe('Hello World');
    });

    it('should handle self-closing tags', () => {
      const htmlText = 'Line 1<br/>Line 2<img src="test.jpg"/>';
      const cleanText = htmlText.replace(HTML_PATTERNS.HTML_TAGS, '');
      expect(cleanText).toBe('Line 1Line 2');
    });
  });

  describe('CDATA', () => {
    it('should extract content from CDATA sections', () => {
      const xmlText = '<title><![CDATA[Hockey Practice]]></title>';
      const match = xmlText.match(HTML_PATTERNS.CDATA);
      expect(match).toBeTruthy();
      expect(match![1]).toBe('Hockey Practice');
    });
  });

  describe('HTML_ENTITIES', () => {
    it('should match common HTML entities', () => {
      expect(HTML_PATTERNS.HTML_ENTITIES.AMP.test('Ben &amp; Jerry')).toBe(true);
      expect(HTML_PATTERNS.HTML_ENTITIES.LT.test('&lt;script&gt;')).toBe(true);
      expect(HTML_PATTERNS.HTML_ENTITIES.GT.test('&lt;script&gt;')).toBe(true);
    });
  });
});

describe('CONTENT_EXTRACTION', () => {
  describe('EVENTS_OBJECT', () => {
    it('should match JavaScript events object from Foothills Edge', () => {
      const jsCode = 'var events = {"2025-01-02": [{"title": "Hockey"}]}';
      expect(CONTENT_EXTRACTION.EVENTS_OBJECT.test(jsCode)).toBe(true);
    });
  });

  describe('CSRF_TOKEN', () => {
    it('should extract CSRF tokens from JavaScript', () => {
      const jsCode = 'window.__csrfToken = "abc123def456";';
      const match = jsCode.match(CONTENT_EXTRACTION.CSRF_TOKEN);
      expect(match).toBeTruthy();
      expect(match![1]).toBe('abc123def456');
    });
  });

  describe('ONLINE_SCHEDULE_LIST', () => {
    it('should match SSPRD schedule list pattern', () => {
      const jsCode = 'var _onlineScheduleList = [{"id": 1, "title": "Hockey"}];';
      const match = jsCode.match(CONTENT_EXTRACTION.ONLINE_SCHEDULE_LIST);
      expect(match).toBeTruthy();
      expect(match![1]).toBe('[{"id": 1, "title": "Hockey"}]');
    });
  });
});

describe('VALIDATION_PATTERNS', () => {
  describe('TIMEZONE_INFO', () => {
    it('should detect timezone information', () => {
      const withTimezone = [
        '2025-01-02T10:30:00Z',
        '2025-01-02T10:30:00-07:00',
        '2025-01-02T10:30:00+05:30',
        '2025-01-02T10:30:00 MST',
        '2025-01-02T10:30:00 UTC'
      ];

      withTimezone.forEach(datetime => {
        expect(VALIDATION_PATTERNS.TIMEZONE_INFO.test(datetime)).toBe(true);
      });
    });

    it('should not detect timezone in naive datetimes', () => {
      const withoutTimezone = [
        '2025-01-02T10:30:00',
        '2025-01-02 10:30:00',
         'January 2, 2025 10:30 AM'
      ];

      withoutTimezone.forEach(datetime => {
        expect(VALIDATION_PATTERNS.TIMEZONE_INFO.test(datetime)).toBe(false);
      });
    });
  });
});

describe('RegexHelpers', () => {
  describe('escape', () => {
    it('should escape regex special characters', () => {
      const specialChars = '.*+?^${}()|[]\\';
      const escaped = RegexHelpers.escape(specialChars);
      expect(escaped).toBe('\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\');
    });

    it('should not affect normal characters', () => {
      const normalText = 'Hello World 123';
      expect(RegexHelpers.escape(normalText)).toBe(normalText);
    });
  });

  describe('parse12HourTime', () => {
    it('should parse valid 12-hour times correctly', () => {
      const testCases = [
        { input: '2:30 PM', expected: { hours: 14, minutes: 30 } },
        { input: '12:00 AM', expected: { hours: 0, minutes: 0 } },
        { input: '12:00 PM', expected: { hours: 12, minutes: 0 } },
        { input: '11:59 PM', expected: { hours: 23, minutes: 59 } },
        { input: '1:15 am', expected: { hours: 1, minutes: 15 } }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = RegexHelpers.parse12HourTime(input);
        expect(result).toEqual(expected);
      });
    });

    it('should return null for invalid times', () => {
      const invalidTimes = [
        '25:00 PM',
        '12:60 AM',
        '2:30',
        'noon',
        ''
      ];

      invalidTimes.forEach(time => {
        expect(RegexHelpers.parse12HourTime(time)).toBeNull();
      });
    });
  });

  describe('cleanHtmlEntities', () => {
    it('should decode common HTML entities', () => {
      const testCases = [
        { input: 'Ben &amp; Jerry', expected: 'Ben & Jerry' },
        { input: '&lt;script&gt;', expected: '<script>' },
        { input: '&quot;Hello&quot;', expected: '"Hello"' },
        { input: '&#39;Hello&#39;', expected: "'Hello'" },
        { input: 'Space&nbsp;here', expected: 'Space here' }
      ];

      testCases.forEach(({ input, expected }) => {
        expect(RegexHelpers.cleanHtmlEntities(input)).toBe(expected);
      });
    });

    it('should handle multiple entities in one string', () => {
      const input = '&lt;p&gt;Ben &amp; Jerry&#39;s&lt;/p&gt;';
      const expected = '<p>Ben & Jerry\'s</p>';
      expect(RegexHelpers.cleanHtmlEntities(input)).toBe(expected);
    });
  });

  describe('cleanTitle', () => {
    it('should clean common title issues', () => {
      const testCases = [
        { input: '1A Hockey Practice', expected: 'A Hockey Practice' },
        { input: '- Public Skate', expected: 'Public Skate' },
        { input: 'Hockey Practice - register now!', expected: 'Hockey Practice -  now!' },
        { input: '  ***Special Event  ', expected: 'Special Event' },
        { input: '', expected: 'Untitled Event' },
        { input: '   ', expected: 'Untitled Event' }
      ];

      testCases.forEach(({ input, expected }) => {
        expect(RegexHelpers.cleanTitle(input)).toBe(expected);
      });
    });
  });
});

// Integration tests with real-world examples
describe('Real-world Pattern Integration', () => {
  it('should handle Ice Ranch RSS description parsing', () => {
    const description = 'Time: 2:30pm - 4:00pm\nLocation: Ice Ranch\nTags: Public,Skate';
    
    // Extract time range
    const timeMatch = description.match(TIME_PATTERNS.TIME_RANGE);
    expect(timeMatch).toBeTruthy();
    expect(timeMatch![1].trim()).toBe('2:30pm');
    
    // Parse individual times
    const startTime = RegexHelpers.parse12HourTime('2:30pm');
    const endTime = RegexHelpers.parse12HourTime('4:00pm');
    
    expect(startTime).toEqual({ hours: 14, minutes: 30 });
    expect(endTime).toEqual({ hours: 16, minutes: 0 });
  });

  it('should handle Foothills Edge JavaScript extraction', () => {
    const htmlContent = `
      <script>
        var events = {"2025-01-02": [
          {"title": "Hockey Practice", "time": "7:30 PM"}
        ]};
      </script>
    `;
    
    // Extract events object
    const eventsMatch = htmlContent.match(CONTENT_EXTRACTION.EVENTS_OBJECT);
    expect(eventsMatch).toBeTruthy();
    
    // Parse time from extracted content
    const timeResult = RegexHelpers.parse12HourTime('7:30 PM');
    expect(timeResult).toEqual({ hours: 19, minutes: 30 });
  });

  it('should handle SSPRD JavaScript variable extraction', () => {
    const htmlContent = `
      <script>
        var _onlineScheduleList = [
          {"id": 1, "title": "Public Skate &amp; Fun", "time": "10:00am"}
        ];
      </script>
    `;
    
    // Extract schedule list
    const scheduleMatch = htmlContent.match(CONTENT_EXTRACTION.ONLINE_SCHEDULE_LIST);
    expect(scheduleMatch).toBeTruthy();
    
    // Clean HTML entities in extracted content
    const cleanTitle = RegexHelpers.cleanHtmlEntities('Public Skate &amp; Fun');
    expect(cleanTitle).toBe('Public Skate & Fun');
  });
});