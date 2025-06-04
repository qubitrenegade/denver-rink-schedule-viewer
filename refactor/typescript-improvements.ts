// 🔴 CURRENT TYPESCRIPT ISSUES:
// 1. Some 'any' types that could be properly typed
// 2. Missing return type annotations
// 3. Could leverage more advanced TS features
// 4. Inconsistent error handling types
// 5. Magic strings that could be const assertions

// ✅ IMPROVED TYPE DEFINITIONS

// 1. Replace magic strings with const assertions
export const EVENT_CATEGORIES = [
  'Public Skate',
  'Stick & Puck',
  'Hockey League',
  'Learn to Skate',
  'Figure Skating',
  'Hockey Practice',
  'Drop-In Hockey',
  'Special Event',
  'Other'
] as const;

export type EventCategory = typeof EVENT_CATEGORIES[number];

export const FILTER_MODES = ['include', 'exclude'] as const;
export type FilterMode = typeof FILTER_MODES[number];

export const DATE_FILTER_MODES = ['next-days', 'specific-day', 'date-range'] as const;
export type DateFilterMode = typeof DATE_FILTER_MODES[number];

// 2. Better error handling types
export type ApiResult<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: string;
  code?: string;
};

export type ScrapingResult = ApiResult<RawIceEventData[]>;

// 3. More specific component prop types
export interface FilterControlsProps {
  readonly allRinks: readonly RinkInfo[];
  readonly selectedRinkId: string;
  readonly allCategories: readonly EventCategory[];
  readonly currentFilterSettings: FilterSettings;
  readonly onFilterSettingsChange: (settings: FilterSettings) => void;
}

// 4. Better event handler types
export type FilterUpdateHandler = (updates: Partial<FilterSettings>) => void;
export type CategoryToggleHandler = (category: EventCategory) => void;
export type RinkSelectHandler = (rinkId: string) => void;

// 5. Discriminated union for scraper states
export type ScraperState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: RawIceEventData[]; timestamp: string }
  | { status: 'error'; error: string; timestamp: string };

// 6. Generic utility types for forms
export type FormField<T> = {
  value: T;
  error?: string;
  touched: boolean;
};

export type FormState<T extends Record<string, any>> = {
  [K in keyof T]: FormField<T[K]>;
};

// 7. Better async function return types
export interface DataFetcher {
  fetchEvents(rinkId: string): Promise<ScrapingResult>;
  fetchMetadata(rinkId: string): Promise<ApiResult<FacilityMetadata>>;
  refreshAll(): Promise<ApiResult<void>>;
}

// 8. Improved scraper interface
export interface IScraper {
  readonly rinkId: string;
  readonly rinkName: string;
  readonly sourceUrl: string;
  scrape(): Promise<RawIceEventData[]>;
  validate?(event: Partial<RawIceEventData>): event is RawIceEventData;
}

// 9. Better date/time utilities with proper typing
export class DateTimeUtils {
  static parseMountainTime(dateStr: string): Date | null {
    try {
      // Implementation with proper error handling
      return new Date(dateStr);
    } catch {
      return null;
    }
  }

  static formatForDisplay(date: Date, timeZone = 'America/Denver'): string {
    return date.toLocaleString('en-US', { timeZone });
  }

  static isValidTimeRange(start: Date, end: Date): boolean {
    return start < end && start > new Date(Date.now() - 24 * 60 * 60 * 1000);
  }
}

// 10. Configuration with strict typing
export interface RinkConfig {
  readonly id: string;
  readonly name: string;
  readonly sourceUrl: string;
  readonly memberRinkIds?: readonly string[];
  readonly scraperClass: new () => IScraper;
  readonly updateFrequency: 'hourly' | 'daily' | 'weekly';
}

// 11. Better error boundary types
export interface ErrorInfo {
  componentStack: string;
  errorBoundary?: string;
  eventType?: string;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
}

// 12. Utility type for component refs
export type ComponentRef<T extends React.ComponentType<any>> =
  T extends React.ComponentType<infer P>
    ? React.Ref<React.ComponentRef<T>>
    : never;

// 13. Stricter filter settings with validation
export interface FilterSettingsValidated extends FilterSettings {
  readonly _validated: true;
}

export const validateFilterSettings = (
  settings: FilterSettings
): FilterSettingsValidated | { error: string } => {
  // Validation logic
  if (settings.dateFilterMode === 'date-range') {
    if (!settings.dateRangeStart || !settings.dateRangeEnd) {
      return { error: 'Date range requires both start and end dates' };
    }
  }

  return { ...settings, _validated: true as const };
};

// 14. Better async component patterns
export interface AsyncComponentState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastFetch: number;
}

export function useAsyncData<T>(
  fetcher: () => Promise<T>,
  deps: React.DependencyList
): AsyncComponentState<T> {
  const [state, setState] = useState<AsyncComponentState<T>>({
    data: null,
    loading: false,
    error: null,
    lastFetch: 0
  });

  useEffect(() => {
    let cancelled = false;

    setState(prev => ({ ...prev, loading: true, error: null }));

    fetcher()
      .then(data => {
        if (!cancelled) {
          setState({
            data,
            loading: false,
            error: null,
            lastFetch: Date.now()
          });
        }
      })
      .catch(error => {
        if (!cancelled) {
          setState(prev => ({
            ...prev,
            loading: false,
            error: error.message
          }));
        }
      });

    return () => { cancelled = true; };
  }, deps);

  return state;
}

// 15. Remove 'any' types from scraper implementations
export interface ScrapedEventData {
  readonly id: string;
  readonly title: string;
  readonly startTime: string; // ISO string
  readonly endTime: string;   // ISO string
  readonly description?: string;
  readonly category: EventCategory;
  readonly sourceUrl?: string;
}

// Replace current scrapers' 'any' usage:
// ❌ eventsJson.map((ev: any) => { ... })
// ✅ eventsJson.map((ev: ScrapedEventData) => { ... })

// BENEFITS:
// - Eliminates all 'any' types
// - Better IntelliSense and autocomplete
// - Compile-time error catching
// - Self-documenting code
// - Easier refactoring
// - Better IDE support