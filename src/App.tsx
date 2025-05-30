import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { RinkInfo, EventCategory, DisplayableIceEvent, FilterSettings, FilterMode, UrlViewType, RawIceEventData, DateFilterMode, TimeFilterMode } from './types';
import { RINKS_CONFIG, ALL_INDIVIDUAL_RINKS_FOR_FILTERING } from './rinkConfig';
import RinkTabs from './components/RinkTabs';
import EventList from './components/EventList';
import FilterControls from './components/FilterControls';
import { LoadingIcon, CalendarIcon, AdjustmentsHorizontalIcon } from './components/icons';

export const ALL_RINKS_TAB_ID = 'all-rinks';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Individual facility metadata (for now, simpler structure until Phase 3)
interface FacilityMetadata {
  facilityId: string;
  lastSuccessfulScrape?: string;
  lastAttempt: string;
  status: 'success' | 'error';
  eventCount: number;
  errorMessage?: string;
}

// Combined metadata structure (legacy support for now)
interface LegacyMetadata {
  lastCombinedUpdate: string;
  rinks: Record<string, {
    lastSuccessfulScrape?: string;
    lastAttempt: string;
    status: 'success' | 'error';
    eventCount: number;
    errorMessage?: string;
  }>;
}

const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [facilityErrors, setFacilityErrors] = useState<Record<string, string>>({});
  const [rinksConfigForTabs] = useState<RinkInfo[]>(RINKS_CONFIG);
  const [individualRinksForFiltering] = useState<RinkInfo[]>(ALL_INDIVIDUAL_RINKS_FOR_FILTERING);
  
  const [staticData, setStaticData] = useState<RawIceEventData[]>([]);
  const [facilityMetadata, setFacilityMetadata] = useState<Record<string, FacilityMetadata>>({});
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);

  const [selectedRinkId, setSelectedRinkId] = useState<UrlViewType>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('view') || ALL_RINKS_TAB_ID;
  });

  const [filterSettings, setFilterSettings] = useState<FilterSettings>(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode') as FilterMode | null;
    const categories = params.get('categories');
    const rinkIdsParam = params.get('rinkIds');
    const rinkModeParam = params.get('rinkMode') as FilterMode | null;
    
    // Date filtering params
    const dateFilterMode = (params.get('dateMode') as DateFilterMode) || 'next-days';
    const numberOfDays = parseInt(params.get('days') || '4');
    const selectedDate = params.get('date') || undefined;
    const dateRangeStart = params.get('dateStart') || undefined;
    const dateRangeEnd = params.get('dateEnd') || undefined;
    
    // Time filtering params
    const timeFilterMode = (params.get('timeMode') as TimeFilterMode) || 'all-times';
    const afterTime = params.get('afterTime') || undefined;
    const beforeTime = params.get('beforeTime') || undefined;
    const timeRangeStart = params.get('timeStart') || undefined;
    const timeRangeEnd = params.get('timeEnd') || undefined;
    
    return {
      activeCategories: categories ? categories.split(',') as EventCategory[] : [],
      filterMode: mode || 'exclude',
      activeRinkIds: rinkIdsParam ? rinkIdsParam.split(',') : [],
      rinkFilterMode: rinkModeParam || 'exclude',
      dateFilterMode,
      numberOfDays,
      selectedDate,
      dateRangeStart,
      dateRangeEnd,
      timeFilterMode,
      afterTime,
      beforeTime,
      timeRangeStart,
      timeRangeEnd,
    };
  });
  
  const [events, setEvents] = useState<DisplayableIceEvent[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const allPossibleCategories = useMemo((): EventCategory[] => {
    const categories = new Set<EventCategory>();
    // Get categories from static data
    staticData.forEach(event => categories.add(event.category));
    
    // Ensure we have common categories even if not in current data
    ['Public Skate', 'Stick & Puck', 'Hockey League', 'Learn to Skate', 'Figure Skating', 'Hockey Practice', 'Drop-In Hockey', 'Special Event'].forEach(cat => {
      categories.add(cat as EventCategory);
    });
    
    return Array.from(categories).sort();
  }, [staticData]);

  // Load all facility files upfront (eliminates loading flashes between tabs)
  const fetchStaticData = useCallback(async (forceRefresh: boolean = false) => {
    // Only refetch if we don't have data or it's been more than 5 minutes (for development)
    if (staticData.length > 0 && !forceRefresh && Date.now() - lastFetchTime < 5 * 60 * 1000) {
      console.log(`📋 Using cached data`);
      return;
    }

    setIsLoading(true);
    setError(null);
    setFacilityErrors({});

    try {
      console.log(`📡 Fetching all facility data...`);
      
      // Load all facility files (eliminates tab switching loading flashes)
      const allFiles = ['ice-ranch.json', 'big-bear.json', 'du-ritchie.json', 'foothills-edge.json', 'ssprd-249.json', 'ssprd-250.json'];
      console.log(`📋 Loading files: ${allFiles.join(', ')}`);
      
      // Load all required files in parallel
      const filePromises = allFiles.map(async (filename) => {
        const facilityId = filename.replace('.json', '');
        try {
          console.log(`   📥 Loading ${filename}...`);
          const response = await fetch(`/data/${filename}`);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const eventsData = await response.json();
          
          // Convert string dates back to Date objects
          const parsedEvents: RawIceEventData[] = eventsData.map((event: any) => ({
            ...event,
            startTime: new Date(event.startTime),
            endTime: new Date(event.endTime),
          }));
          
          console.log(`   ✅ Loaded ${parsedEvents.length} events from ${filename}`);
          
          return {
            facilityId,
            events: parsedEvents,
            success: true,
            error: null
          };
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          console.error(`   ❌ Failed to load ${filename}:`, errorMessage);
          return {
            facilityId,
            events: [],
            success: false,
            error: errorMessage
          };
        }
      });
      
      const results = await Promise.all(filePromises);
      
      // Combine all successful results
      const allEvents: RawIceEventData[] = [];
      const newFacilityErrors: Record<string, string> = {};
      const newFacilityMetadata: Record<string, FacilityMetadata> = {};
      
      results.forEach(result => {
        if (result.success) {
          allEvents.push(...result.events);
          // Create basic metadata for successful loads
          newFacilityMetadata[result.facilityId] = {
            facilityId: result.facilityId,
            lastAttempt: new Date().toISOString(),
            status: 'success',
            eventCount: result.events.length,
            lastSuccessfulScrape: new Date().toISOString()
          };
        } else {
          if (result.error) {
            newFacilityErrors[result.facilityId] = result.error;
          }
          // Create error metadata
          newFacilityMetadata[result.facilityId] = {
            facilityId: result.facilityId,
            lastAttempt: new Date().toISOString(),
            status: 'error',
            eventCount: 0,
            errorMessage: result.error || 'Unknown error'
          };
        }
      });
      
      // Try to load legacy metadata as fallback
      try {
        const metadataResponse = await fetch('/data/metadata.json');
        if (metadataResponse.ok) {
          const legacyMetadata: LegacyMetadata = await metadataResponse.json();
          // Merge legacy metadata where we don't have new metadata
          Object.entries(legacyMetadata.rinks).forEach(([rinkId, meta]) => {
            if (!newFacilityMetadata[rinkId]) {
              newFacilityMetadata[rinkId] = {
                facilityId: rinkId,
                ...meta
              };
            }
          });
        }
      } catch (metaError) {
        console.warn('Could not fetch legacy metadata:', metaError);
      }
      
      setStaticData(allEvents);
      setFacilityErrors(newFacilityErrors);
      setFacilityMetadata(newFacilityMetadata);
      setLastFetchTime(Date.now());
      
      const successCount = results.filter(r => r.success).length;
      const errorCount = results.filter(r => !r.success).length;
      
      console.log(`✅ Data loading complete: ${successCount} successful, ${errorCount} failed`);
      console.log(`📊 Total events loaded: ${allEvents.length}`);
      
      // Set error message if all facilities failed
      if (errorCount > 0 && successCount === 0) {
        setError(`Failed to load data from all facilities. Check your connection and try again.`);
      }
      
    } catch (err) {
      console.error('Error during data loading:', err);
      setError(`Failed to load schedule data: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, [staticData.length, lastFetchTime]);

  // Helper function to parse time string to hours and minutes
  const parseTime = (timeString: string): { hours: number; minutes: number } => {
    const [hours, minutes] = timeString.split(':').map(Number);
    return { hours, minutes };
  };

  // Helper function to get time in minutes from midnight
  const getMinutesFromMidnight = (date: Date): number => {
    return date.getHours() * 60 + date.getMinutes();
  };

  const filterAndDisplayEvents = useCallback((rinkTabId: UrlViewType, currentFilters: FilterSettings, sourceData: RawIceEventData[]) => {
    console.log("Filtering data for tab:", { rinkTabId, currentFilters, dataLength: sourceData.length });
    
    let processedData = [...sourceData];

    // 1. Date Range Filter
    let startDate: Date;
    let endDate: Date;

    if (currentFilters.dateFilterMode === 'next-days') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      startDate = today;
      endDate = new Date(today.getTime() + (currentFilters.numberOfDays || 4) * MS_PER_DAY);
      endDate.setHours(23, 59, 59, 999);
    } else if (currentFilters.dateFilterMode === 'specific-day') {
      if (currentFilters.selectedDate) {
        startDate = new Date(currentFilters.selectedDate + 'T00:00:00');
        endDate = new Date(currentFilters.selectedDate + 'T23:59:59');
      } else {
        // Fallback to today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        startDate = today;
        endDate = new Date(today);
        endDate.setHours(23, 59, 59, 999);
      }
    } else if (currentFilters.dateFilterMode === 'date-range') {
      if (currentFilters.dateRangeStart && currentFilters.dateRangeEnd) {
        startDate = new Date(currentFilters.dateRangeStart + 'T00:00:00');
        endDate = new Date(currentFilters.dateRangeEnd + 'T23:59:59');
      } else {
        // Fallback to next 7 days
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        startDate = today;
        endDate = new Date(today.getTime() + 7 * MS_PER_DAY);
        endDate.setHours(23, 59, 59, 999);
      }
    } else {
      // Fallback
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      startDate = today;
      endDate = new Date(today.getTime() + 4 * MS_PER_DAY);
      endDate.setHours(23, 59, 59, 999);
    }
    
    console.log(`Date range: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`);

    processedData = processedData.filter(event => {
      const eventStartTime = event.startTime;
      return eventStartTime >= startDate && eventStartTime <= endDate;
    });
    console.log(`After date filter: ${processedData.length} events`);

    // 2. Time Filter
    if (currentFilters.timeFilterMode !== 'all-times') {
      processedData = processedData.filter(event => {
        const eventTime = getMinutesFromMidnight(event.startTime);
        
        if (currentFilters.timeFilterMode === 'after-time' && currentFilters.afterTime) {
          const { hours, minutes } = parseTime(currentFilters.afterTime);
          const afterTimeMinutes = hours * 60 + minutes;
          return eventTime >= afterTimeMinutes;
        } else if (currentFilters.timeFilterMode === 'before-time' && currentFilters.beforeTime) {
          const { hours, minutes } = parseTime(currentFilters.beforeTime);
          const beforeTimeMinutes = hours * 60 + minutes;
          return eventTime < beforeTimeMinutes;
        } else if (currentFilters.timeFilterMode === 'time-range' && currentFilters.timeRangeStart && currentFilters.timeRangeEnd) {
          const { hours: startHours, minutes: startMinutes } = parseTime(currentFilters.timeRangeStart);
          const { hours: endHours, minutes: endMinutes } = parseTime(currentFilters.timeRangeEnd);
          const startTimeMinutes = startHours * 60 + startMinutes;
          const endTimeMinutes = endHours * 60 + endMinutes;
          return eventTime >= startTimeMinutes && eventTime <= endTimeMinutes;
        }
        
        return true;
      });
      
      console.log(`After time filter: ${processedData.length} events`);
    }

    // 3. Tab-specific filtering (for individual/group tabs)
    const selectedTabConfig = rinksConfigForTabs.find(r => r.id === rinkTabId);
    
    if (rinkTabId !== ALL_RINKS_TAB_ID) {
      if (selectedTabConfig?.memberRinkIds) {
        // Group tab - filter to member rinks
        processedData = processedData.filter(event => 
          selectedTabConfig.memberRinkIds!.includes(event.rinkId)
        );
      } else {
        // Individual tab - filter to specific rink
        processedData = processedData.filter(event => event.rinkId === rinkTabId);
      }
      console.log(`After tab-specific filter: ${processedData.length} events`);
    }

    // 4. Rink Filter (only for 'All Rinks' view, based on individual rinks)
    if (rinkTabId === ALL_RINKS_TAB_ID && currentFilters.activeRinkIds && currentFilters.activeRinkIds.length > 0) {
      processedData = processedData.filter(event => {
        if (currentFilters.rinkFilterMode === 'include') {
          return currentFilters.activeRinkIds!.includes(event.rinkId);
        } else { // exclude
          return !currentFilters.activeRinkIds!.includes(event.rinkId);
        }
      });
      console.log(`After 'All Rinks' view specific rink filter: ${processedData.length} events`);
    }
    
    // 5. Prepare for display (add rinkName)
    const rawEventsWithDates: Array<RawIceEventData & { rinkName?: string }> = processedData.map(e => ({
      ...e,
      rinkName: individualRinksForFiltering.find(r => r.id === e.rinkId)?.name || e.rinkId
    }));
    
    console.log(`After preparing for display (rinkName): ${rawEventsWithDates.length} events`);
    
    // 6. Category Filter
    const processedEvents: DisplayableIceEvent[] = rawEventsWithDates.map(event => ({
      ...event,
      startTime: event.startTime.toISOString(),
      endTime: event.endTime.toISOString(),
    })).filter(event => {
      if (currentFilters.filterMode === 'include') {
        return currentFilters.activeCategories.length === 0 ? false : currentFilters.activeCategories.includes(event.category);
      } else { 
        return !currentFilters.activeCategories.includes(event.category);
      }
    });
    console.log(`After category filter: ${processedEvents.length} events`);
    
    const sortedEvents = processedEvents.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    console.log("Setting filtered events:", sortedEvents.length);
    setEvents(sortedEvents);
  }, [rinksConfigForTabs, individualRinksForFiltering]);

  // Load data when app starts
  useEffect(() => {
    fetchStaticData();
  }, [fetchStaticData]);

  // Filter events when data or filters change
  useEffect(() => {
    if (staticData.length > 0) {
      filterAndDisplayEvents(selectedRinkId, filterSettings, staticData);
    }
  }, [selectedRinkId, filterSettings, staticData, filterAndDisplayEvents]);

  // URL state management
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('view', selectedRinkId);

    if (filterSettings.filterMode !== 'exclude' || filterSettings.activeCategories.length > 0) {
      params.set('mode', filterSettings.filterMode);
    }
    if (filterSettings.activeCategories.length > 0) {
      params.set('categories', filterSettings.activeCategories.join(','));
    }
    if (filterSettings.rinkFilterMode !== 'exclude' || (filterSettings.activeRinkIds && filterSettings.activeRinkIds.length > 0)) {
      params.set('rinkMode', filterSettings.rinkFilterMode || 'exclude');
    }
    if (filterSettings.activeRinkIds && filterSettings.activeRinkIds.length > 0) {
      params.set('rinkIds', filterSettings.activeRinkIds.join(','));
    }

    // Date filtering URL params
    if (filterSettings.dateFilterMode !== 'next-days') {
      params.set('dateMode', filterSettings.dateFilterMode);
    }
    if (filterSettings.dateFilterMode === 'next-days' && filterSettings.numberOfDays !== 4) {
      params.set('days', filterSettings.numberOfDays?.toString() || '4');
    }
    if (filterSettings.dateFilterMode === 'specific-day' && filterSettings.selectedDate) {
      params.set('date', filterSettings.selectedDate);
    }
    if (filterSettings.dateFilterMode === 'date-range') {
      if (filterSettings.dateRangeStart) params.set('dateStart', filterSettings.dateRangeStart);
      if (filterSettings.dateRangeEnd) params.set('dateEnd', filterSettings.dateRangeEnd);
    }

    // Time filtering URL params
    if (filterSettings.timeFilterMode !== 'all-times') {
      params.set('timeMode', filterSettings.timeFilterMode);
    }
    if (filterSettings.timeFilterMode === 'after-time' && filterSettings.afterTime) {
      params.set('afterTime', filterSettings.afterTime);
    }
    if (filterSettings.timeFilterMode === 'before-time' && filterSettings.beforeTime) {
      params.set('beforeTime', filterSettings.beforeTime);
    }
    if (filterSettings.timeFilterMode === 'time-range') {
      if (filterSettings.timeRangeStart) params.set('timeStart', filterSettings.timeRangeStart);
      if (filterSettings.timeRangeEnd) params.set('timeEnd', filterSettings.timeRangeEnd);
    }

    const newSearchString = params.toString();
    const newUrlTarget = newSearchString ? `${window.location.pathname}?${newSearchString}` : window.location.pathname;
    
    const currentFullUrl = `${window.location.pathname}${window.location.search}`;

    if (currentFullUrl !== newUrlTarget) {
      const timeoutId = setTimeout(() => {
        try {
          window.history.replaceState(null, '', newUrlTarget);
        } catch (e: any) {
          console.error("Error updating URL:", e);
        }
      }, 300); 
      return () => clearTimeout(timeoutId);
    }
  }, [selectedRinkId, filterSettings]);

  const handleRinkSelect = (rinkId: UrlViewType) => {
    setSelectedRinkId(rinkId);
  };

  const handleFilterSettingsChange = (newFilterSettings: FilterSettings) => {
    setFilterSettings(newFilterSettings);
  };

  const selectedRinkTabInfo = selectedRinkId !== ALL_RINKS_TAB_ID ? rinksConfigForTabs.find(rink => rink.id === selectedRinkId) : null;

  const getLastUpdateInfo = () => {
    if (selectedRinkId === ALL_RINKS_TAB_ID) {
      // For "All Rinks", show the most recent update across all facilities
      let latestUpdate = '';
      Object.values(facilityMetadata).forEach(meta => {
        if (meta.lastSuccessfulScrape) {
          if (!latestUpdate || meta.lastSuccessfulScrape > latestUpdate) {
            latestUpdate = meta.lastSuccessfulScrape;
          }
        }
      });
      return latestUpdate ? new Date(latestUpdate).toLocaleString() : 'Unknown';
    } else {
      // For individual/group tabs, find relevant metadata
      const selectedTabConfig = rinksConfigForTabs.find(r => r.id === selectedRinkId);
      let latestUpdate = '';
      
      if (selectedTabConfig?.memberRinkIds) {
        // Group tab - check all relevant facilities
        selectedTabConfig.memberRinkIds.forEach(rinkId => {
          // Map rinkId to facility file
          let facilityId = rinkId;
          if (rinkId.startsWith('fsc-')) facilityId = 'ssprd-249';
          if (rinkId.startsWith('sssc-')) facilityId = 'ssprd-250';
          
          const meta = facilityMetadata[facilityId];
          if (meta?.lastSuccessfulScrape) {
            if (!latestUpdate || meta.lastSuccessfulScrape > latestUpdate) {
              latestUpdate = meta.lastSuccessfulScrape;
            }
          }
        });
      } else {
        // Individual tab
        const meta = facilityMetadata[selectedRinkId];
        if (meta?.lastSuccessfulScrape) {
          latestUpdate = meta.lastSuccessfulScrape;
        }
      }
      
      return latestUpdate ? new Date(latestUpdate).toLocaleString() : 'Unknown';
    }
  };

  // Helper function to describe current filter state
  const getFilterDescription = () => {
    const parts: string[] = [];
    
    // Date description
    if (filterSettings.dateFilterMode === 'next-days') {
      parts.push(`next ${filterSettings.numberOfDays || 4} days`);
    } else if (filterSettings.dateFilterMode === 'specific-day' && filterSettings.selectedDate) {
      const date = new Date(filterSettings.selectedDate + 'T00:00:00');
      parts.push(`${date.toLocaleDateString()}`);
    } else if (filterSettings.dateFilterMode === 'date-range' && filterSettings.dateRangeStart && filterSettings.dateRangeEnd) {
      const startDate = new Date(filterSettings.dateRangeStart + 'T00:00:00');
      const endDate = new Date(filterSettings.dateRangeEnd + 'T00:00:00');
      parts.push(`${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`);
    }
    
    // Time description
    if (filterSettings.timeFilterMode === 'after-time' && filterSettings.afterTime) {
      parts.push(`after ${filterSettings.afterTime}`);
    } else if (filterSettings.timeFilterMode === 'before-time' && filterSettings.beforeTime) {
      parts.push(`before ${filterSettings.beforeTime}`);
    } else if (filterSettings.timeFilterMode === 'time-range' && filterSettings.timeRangeStart && filterSettings.timeRangeEnd) {
      parts.push(`between ${filterSettings.timeRangeStart} and ${filterSettings.timeRangeEnd}`);
    }
    
    return parts.length > 0 ? `Showing events for ${parts.join(', ')}.` : 'Showing events with custom filtering.';
  };

  // Get error message if there are any facility errors
  const hasAnyErrors = Object.keys(facilityErrors).length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-700 text-gray-100 p-4 sm:p-6 md:p-8">
      <header className="mb-6 text-center">
        <div className="max-w-6xl mx-auto mb-4">
          <img 
            src="/images/header.png" 
            alt="Denver Rink Schedule" 
            className="w-full max-h-48 object-contain rounded-lg shadow-lg"
          />
        </div>
        <div className="flex items-center justify-center mb-2">
          <CalendarIcon className="w-10 h-10 mr-3 text-sky-400" />
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-cyan-300">
            Denver Rink Schedule
          </h1>
        </div>
        <p className="text-sm text-slate-400 italic max-w-2xl mx-auto">
          {getFilterDescription()} Data is automatically updated twice daily via GitHub Actions.
        </p>
      </header>

      <div className="max-w-6xl mx-auto bg-slate-800 shadow-2xl rounded-lg overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-700">
          <RinkTabs
            rinks={rinksConfigForTabs}
            selectedRinkId={selectedRinkId}
            onSelectRink={handleRinkSelect}
            allRinksTabId={ALL_RINKS_TAB_ID}
          />
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center justify-center w-full sm:w-auto px-4 py-2 text-sm font-medium text-slate-200 bg-slate-700 hover:bg-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-75 transition-colors"
                aria-expanded={showFilters}
                aria-controls="filter-panel"
              >
                <AdjustmentsHorizontalIcon className="w-5 h-5 mr-2" />
                {showFilters ? 'Hide Filters' : 'Show Filters'}
                {((filterSettings.activeCategories.length > 0) || 
                  (filterSettings.activeRinkIds && filterSettings.activeRinkIds.length > 0) ||
                  (filterSettings.dateFilterMode !== 'next-days') ||
                  (filterSettings.numberOfDays !== 4) ||
                  (filterSettings.timeFilterMode !== 'all-times')) && !showFilters && (
                  <span className="ml-2 bg-sky-500 text-sky-100 text-xs font-bold px-2 py-0.5 rounded-full">
                    Active
                  </span>
                )}
              </button>
              
              <div className="flex items-center px-4 py-2 text-sm bg-green-600/20 text-green-300 rounded-md">
                <div className="w-2 h-2 rounded-full mr-2 bg-green-300" />
                Static Data
                <span className="ml-2 text-xs opacity-75">
                  (Updated: {getLastUpdateInfo()})
                </span>
              </div>

              {/* Show facility errors if any */}
              {Object.keys(facilityErrors).length > 0 && (
                <div className="flex items-center px-4 py-2 text-sm bg-yellow-600/20 text-yellow-300 rounded-md">
                  <div className="w-2 h-2 rounded-full mr-2 bg-yellow-300" />
                  {Object.keys(facilityErrors).length} Facility Error{Object.keys(facilityErrors).length > 1 ? 's' : ''}
                </div>
              )}
            </div>
          </div>
          {showFilters && (
            <div id="filter-panel" className="mt-4 p-4 bg-slate-700/50 rounded-md">
              <FilterControls
                allRinks={individualRinksForFiltering}
                selectedRinkId={selectedRinkId}
                allCategories={allPossibleCategories}
                currentFilterSettings={filterSettings}
                onFilterSettingsChange={handleFilterSettingsChange}
              />
            </div>
          )}
        </div>
        
        <div className="p-6 min-h-[400px]">
          {selectedRinkTabInfo && (
            <div className="mb-6 p-4 border border-slate-700 rounded-lg bg-slate-700/50">
              <h2 className="text-2xl font-semibold text-sky-300 mb-1">{selectedRinkTabInfo.name}</h2>
              <p className="text-sm text-slate-400">
                Source: <a href={selectedRinkTabInfo.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:text-sky-300 underline transition-colors">
                  {selectedRinkTabInfo.sourceUrl}
                </a>
                {selectedRinkTabInfo.memberRinkIds && selectedRinkTabInfo.memberRinkIds.length > 0 && (
                  <span className="ml-2 text-xs text-slate-500">(Showing events for {selectedRinkTabInfo.memberRinkIds.length} rinks)</span>
                )}
              </p>
            </div>
          )}
          {selectedRinkId === ALL_RINKS_TAB_ID && (
            <div className="mb-6 p-4 border border-slate-700 rounded-lg bg-slate-700/50">
              <h2 className="text-2xl font-semibold text-sky-300 mb-1">All Rinks View</h2>
              <p className="text-sm text-slate-400">
                Showing events from all Denver area ice rinks. Data automatically updated twice daily.
              </p>
              <p className="text-xs text-green-400 mt-1">
                📊 {staticData.length} total events loaded
              </p>
            </div>
          )}

          {isLoading && (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <LoadingIcon className="w-12 h-12 mb-4" />
              <p className="text-lg">Loading schedule data...</p>
            </div>
          )}

          {!isLoading && (error || hasAnyErrors) && (
            <div className="flex flex-col items-center justify-center h-64 text-red-400 bg-red-900/20 p-6 rounded-md">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mb-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
              <p className="text-lg font-semibold">Error Loading Data</p>
              <p className="text-sm text-center">{error || 'Some facilities failed to load'}</p>
              <p className="text-xs text-slate-500 mt-2">Data updates automatically via GitHub Actions</p>
            </div>
          )}
          
          {!isLoading && !error && !hasAnyErrors && events.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 mb-4 text-slate-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5v-.008ZM9.75 12h.008v.008H9.75v-.008ZM7.5 12h.008v.008H7.5v-.008ZM14.25 15h.008v.008H14.25v-.008ZM14.25 12h.008v.008H14.25v-.008ZM16.5 15h.008v.008H16.5v-.008ZM16.5 12h.008v.008H16.5v-.008Z" />
              </svg>
              <p className="text-lg">No events found for the selected criteria and date range.</p>
              <p className="text-sm text-slate-500">
                Try adjusting filters or check back later for updated data.
              </p>
            </div>
          )}

          {!isLoading && !error && !hasAnyErrors && events.length > 0 && (
            <EventList events={events} />
          )}
        </div>
      </div>
      <footer className="text-center mt-8 text-sm text-slate-500">
        <p>&copy; {new Date().getFullYear()} Denver Rink Schedule. Data updated automatically via GitHub Actions.</p>
        <p className="mt-1">
          Last data update: {getLastUpdateInfo()}
        </p>
      </footer>
    </div>
  );
};

export default App;
