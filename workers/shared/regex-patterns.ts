// workers/shared/regex-patterns.ts - Shared regex patterns for all scrapers

export const TIME_PATTERNS = {
  // 12-hour time with AM/PM (e.g., "2:30 PM", "12:00pm")
  TIME_12_HOUR: /(\d{1,2}):(\d{2})\s*([AP])\.?M\.?/i,
  
  // Time range with AM/PM (e.g., "Time: 2:30pm - 4:00pm")
  TIME_RANGE: /Time:\s*([\d:apm ]+)\s*-\s*(\d{1,2}:\d{2}[ap]m)/i,
  
  // 24-hour time (e.g., "14:30")
  TIME_24_HOUR: /(\d{1,2}):(\d{2})/,
  
  // Time with optional seconds (e.g., "14:30:00")
  TIME_WITH_SECONDS: /(\d{1,2}):(\d{2})(?::(\d{2}))?/
} as const;

export const DATE_PATTERNS = {
  // ISO date format (e.g., "2025-01-02")
  ISO_DATE: /^\d{4}-\d{2}-\d{2}$/,
  
  // Date with day name prefix (e.g., "Monday January 2, 2025:")
  DATE_WITH_DAY: /^[A-Za-z]+ [A-Za-z]+ \d{1,2}, \d{4}:\s*/,
  
  // MM/DD/YYYY format
  US_DATE: /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
  
  // Events date range for JavaScript extraction
  EVENTS_DATE_RANGE: /"[0-9]{4}-[0-9]{2}-[0-9]{2}"/
} as const;

export const HTML_PATTERNS = {
  // HTML tags removal
  HTML_TAGS: /<[^>]*>/g,
  
  // CDATA sections in XML
  CDATA: /<!\[CDATA\[(.*?)\]\]>/s,
  
  // HTML entities
  HTML_ENTITIES: {
    AMP: /&amp;/g,
    LT: /&lt;/g,
    GT: /&gt;/g,
    QUOT: /&quot;/g,
    APOS: /&#39;/g,
    NBSP: /&nbsp;/g
  },
  
  // Multiple newlines/whitespace cleanup
  MULTIPLE_NEWLINES: /\n{3,}/g,
  MULTIPLE_SPACES: /\s{2,}/g,
  
  // Title cleaning patterns
  LEADING_NUMBERS_LETTERS: /^\d{1,2}([A-Za-z])/,  // "1A" -> "A"
  LEADING_DASHES: /^-\s*/,
  LEADING_NON_WORD: /^\W+/
} as const;

export const CONTENT_EXTRACTION = {
  // JavaScript object/array extraction
  EVENTS_OBJECT: /events\s*=\s*\{"[0-9]{4}-[0-9]{2}-[0-9]{2}"/,
  CSRF_TOKEN: /window\.__csrfToken\s*=\s*"([^"]+)"/,
  ONLINE_SCHEDULE_LIST: /_onlineScheduleList\s*=\s*(\[.*?\]);/s,
  
  // iCal parsing
  ICAL_FOLDING: /^\s+/, // Detects line folding in iCal
  
  // URL parameter extraction
  URL_PARAMS: /[?&]([^=#]+)=([^&#]*)/g
} as const;

export const VALIDATION_PATTERNS = {
  // Event validation
  EMPTY_TITLE: /^\s*$/,
  PROMOTIONAL_TEXT: /register|click here/gi,
  
  // Timezone detection
  TIMEZONE_INFO: /[+-]\d{2}:?\d{2}|Z|UTC|GMT|[A-Z]{3,4}T?$/i
} as const;

// Helper functions for common regex operations
export const RegexHelpers = {
  // Escape regex special characters in a string
  escape: (str: string): string => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  },

  // Parse 12-hour time to 24-hour format
  parse12HourTime: (timeStr: string): { hours: number; minutes: number } | null => {
    const match = timeStr.match(TIME_PATTERNS.TIME_12_HOUR);
    if (!match) return null;

    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const ampm = match[3].toLowerCase();

    // Validate hour and minute ranges
    if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
      return null;
    }

    if (ampm === 'p' && hours !== 12) hours += 12;
    if (ampm === 'a' && hours === 12) hours = 0;

    return { hours, minutes };
  },

  // Clean HTML entities from text
  cleanHtmlEntities: (text: string): string => {
    return text
      .replace(HTML_PATTERNS.HTML_ENTITIES.AMP, '&')
      .replace(HTML_PATTERNS.HTML_ENTITIES.LT, '<')
      .replace(HTML_PATTERNS.HTML_ENTITIES.GT, '>')
      .replace(HTML_PATTERNS.HTML_ENTITIES.QUOT, '"')
      .replace(HTML_PATTERNS.HTML_ENTITIES.APOS, "'")
      .replace(HTML_PATTERNS.HTML_ENTITIES.NBSP, ' ');
  },

  
  // Clean title text using common patterns
  cleanTitle: (title: string): string => {
    if (!title || !title.trim()) return 'Untitled Event';

    return title.trim()
      .replace(HTML_PATTERNS.LEADING_NUMBERS_LETTERS, '$1')
      .replace(HTML_PATTERNS.LEADING_DASHES, '')
      .replace(VALIDATION_PATTERNS.PROMOTIONAL_TEXT, '')
      .replace(HTML_PATTERNS.LEADING_NON_WORD, '')
      .trim() || 'Untitled Event';
  }
} as const;