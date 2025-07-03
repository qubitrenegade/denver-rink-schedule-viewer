// Type definitions for rink schedule viewer app

export interface RinkInfo {
  id: string;
  name: string;
  sourceUrl: string;
  memberRinkIds?: string[];
}

export type EventCategory =
  | 'Public Skate'
  | 'Stick & Puck'
  | 'Hockey League'
  | 'Learn to Skate'
  | 'Figure Skating'
  | 'Hockey Practice'
  | 'Drop-In Hockey'
  | 'Special Event'
  | 'Other';

// Event as stored in app state (dates as ISO strings)
export interface IceEvent {
  id: string;
  rinkId: string;
  title: string;
  startTime: string;
  endTime: string;
  description?: string;
  category: EventCategory;
  isFeatured?: boolean;
  eventUrl?: string;
}

// Event as displayed (may include rinkName and facilityName)
export interface DisplayableIceEvent extends IceEvent {
  rinkName?: string;
  facilityName?: string;
}

export type FilterMode = 'include' | 'exclude';
export type DateFilterMode = 'next-days' | 'specific-day' | 'date-range';
export type TimeFilterMode = 'all-times' | 'after-time' | 'before-time' | 'time-range';

export interface FilterSettings {
  activeCategories: EventCategory[];
  filterMode: FilterMode;
  activeRinkIds?: string[];
  rinkFilterMode?: FilterMode;
  dateFilterMode: DateFilterMode;
  numberOfDays?: number;
  selectedDate?: string;
  dateRangeStart?: string;
  dateRangeEnd?: string;
  timeFilterMode: TimeFilterMode;
  afterTime?: string;
  beforeTime?: string;
  timeRangeStart?: string;
  timeRangeEnd?: string;
}

export type UrlViewType = string;

// Raw event data from scrapers (dates as Date objects)
export interface RawIceEventData {
  id: string;
  rinkId: string;
  title: string;
  startTime: Date;
  endTime: Date;
  description?: string;
  category: EventCategory;
  isFeatured?: boolean;
  eventUrl?: string;
}

// Facility metadata from scrapers
export interface FacilityMetadata {
  facilityId: string;
  facilityName: string;
  displayName: string;
  lastAttempt: string;
  status: 'success' | 'error';
  eventCount: number;
  errorMessage?: string;
  sourceUrl: string;
  rinks: {
    rinkId: string;
    rinkName: string;
  }[];
  lastSuccessfulScrape?: string;
}

// Only necessary types/interfaces are exported. Comments clarified.
