

export interface RinkInfo {
  id: string;
  name: string;
  sourceUrl: string; // The URL provided by the user for the calendar
  memberRinkIds?: string[]; // For group rinks, lists IDs of member rinks
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

// This interface now uses string for dates to ensure serializability in React state
export interface IceEvent {
  id: string;
  rinkId: string;
  title: string;
  startTime: string; // Changed from Date to string (ISO format)
  endTime: string;   // Changed from Date to string (ISO format)
  description?: string;
  category: EventCategory;
  isFeatured?: boolean; // For potential special highlighting
  eventUrl?: string; // Optional URL for the specific event
}

// Used for displaying events, potentially with added info like rinkName
export interface DisplayableIceEvent extends IceEvent {
  rinkName?: string; 
}

export type FilterMode = 'include' | 'exclude';

export interface FilterSettings {
  activeCategories: EventCategory[]; 
  filterMode: FilterMode;
  activeRinkIds?: string[]; // For filtering rinks in 'All Rinks' view
  rinkFilterMode?: FilterMode; // Mode for rink filtering ('include' or 'exclude')
}

export type UrlViewType = string; // Rink ID or 'all-rinks'

// Interface for the raw event data coming from MOCK_EVENTS_DATA or scrapers, which uses Date objects
export interface RawIceEventData {
  id: string;
  rinkId: string;
  title: string;
  startTime: Date;
  endTime: Date;
  description?: string;
  category: EventCategory;
  isFeatured?: boolean;
  eventUrl?: string; // Optional URL for the specific event, often from the source
}