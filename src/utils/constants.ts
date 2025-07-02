// Shared constants for the Denver Rink Schedule Viewer

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

// Cache durations (in milliseconds)
export const CACHE_DURATIONS = {
  API_CACHE: 5 * 60 * 1000, // 5 minutes
  STATIC_CACHE: 7 * 24 * 60 * 60 * 1000, // 7 days
  IMAGE_CACHE: 30 * 24 * 60 * 60 * 1000, // 30 days
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

// Filter defaults
export const FILTER_DEFAULTS = {
  NUMBER_OF_DAYS: 4,
  DATE_FILTER_MODE: 'next-days' as const,
  TIME_FILTER_MODE: 'all-times' as const,
} as const;

// API endpoints
export const API_ENDPOINTS = {
  ALL_EVENTS: '/api/all-events',
  ALL_METADATA: '/api/all-metadata',
  FACILITY_EVENTS: (facilityId: string) => `/api/events/${facilityId}`,
  FACILITY_METADATA: (facilityId: string) => `/api/metadata/${facilityId}`,
} as const;

// CORS headers configuration
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
} as const;