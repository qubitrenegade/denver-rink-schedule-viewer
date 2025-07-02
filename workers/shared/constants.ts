// Shared constants for Cloudflare Workers

// Facility IDs - centralized list to avoid duplication
export const FACILITY_IDS = [
  'ice-ranch',
  'big-bear',
  'du-ritchie',
  'foothills-edge',
  'ssprd-fsc',
  'ssprd-sssc',
  'apex-ice'
] as const;

export type FacilityId = typeof FACILITY_IDS[number];

// CORS headers configuration
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400', // 24 hours
} as const;

// HTTP status codes
export const HTTP_STATUS = {
  OK: 200,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// Default configuration values
export const DEFAULT_CONFIG = {
  SCRAPER_SPLAY_MINUTES: 360,
  MAX_RETRY_ATTEMPTS: 3,
  REQUEST_TIMEOUT: 30000, // 30 seconds
} as const;

// Cache durations (in seconds for HTTP headers)
export const CACHE_DURATIONS = {
  EVENTS: 300, // 5 minutes
  METADATA: 300, // 5 minutes
  ERRORS: 60, // 1 minute
} as const;