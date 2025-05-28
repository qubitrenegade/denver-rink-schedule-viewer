import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { RinkInfo, EventCategory, DisplayableIceEvent, FilterSettings, FilterMode, UrlViewType, RawIceEventData } from './types';
import { RINKS_CONFIG, ALL_INDIVIDUAL_RINKS_FOR_FILTERING } from './mockData';
import RinkTabs from './components/RinkTabs';
import EventList from './components/EventList';
import FilterControls from './components/FilterControls';
import { LoadingIcon, CalendarIcon, AdjustmentsHorizontalIcon, RefreshIcon } from './components/icons';

export const ALL_RINKS_TAB_ID = 'all-rinks';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface Metadata {
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
  const [rinksConfigForTabs] = useState<RinkInfo[]>(RINKS_CONFIG);
  const [individualRinksForFiltering] = useState<RinkInfo[]>(ALL_INDIVIDUAL_RINKS_FOR_FILTERING);
  
  const [staticData, setStaticData] = useState<RawIceEventData[]>([]);
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);

  const [numberOfDaysToShow] = useState<number>(4); 

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
    
    return {
      activeCategories: categories ? categories.split(',') as EventCategory[] : [],
      filterMode: mode || 'exclude',
      activeRinkIds: rinkIdsParam ? rinkIdsParam.split(',') : [],
      rinkFilterMode: rinkModeParam || 'exclude',
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

  const fetchStaticData = useCallback(async (forceRefresh: boolean = false) => {
    // Only refetch if we don't have data or it's been more than 5 minutes (for development)
    if (staticData.length > 0 && !forceRefresh && Date.now() - lastFetchTime < 5 * 60 * 1000) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('📡 Fetching static data...');
      
      // Fetch combined events data
      const eventsResponse = await fetch('/data/combined.json');
      if (!eventsResponse.ok) {
        throw new Error(`Failed to fetch events data: ${eventsResponse.status}`);
      }
      
      const eventsData = await eventsResponse.json();
      
      // Convert string dates back to Date objects
      const parsedEvents: RawIceEventData[] = eventsData.map((event: any) => ({
        ...event,
        startTime: new Date(event.startTime),
        endTime: new Date(event.endTime),
      }));
      
      // Fetch metadata
      let metadataData: Metadata | null = null;
      try {
        const metadataResponse = await fetch('/data/metadata.json');
        if (metadataResponse.ok) {
          metadataData = await metadataResponse.json();
        }
      } catch (metaError) {
        console.warn('Could not fetch metadata:', metaError);
      }
      
      setStaticData(parsedEvents);
      setMetadata(metadataData);
      setLastFetchTime(Date.now());
      
      console.log(`✅ Loaded ${parsedEvents.length} events from static data`);
      
    } catch (err) {
      console.error('Error fetching static data:', err);
      setError(`Failed to load schedule data: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, [staticData.length, lastFetchTime]);

  const filterAndDisplayEvents = useCallback((rinkTabId: UrlViewType, currentFilters: FilterSettings, sourceData: RawIceEventData[]) => {
    console.log("Filtering data for tab:", { rinkTabId, currentFilters, dataLength: sourceData.length });
    
    let processedData = [...sourceData];

    // 1. Date Range Filter
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDateLimit = new Date(today.getTime() + numberOfDaysToShow * MS_PER_DAY);
    endDateLimit.setHours(23, 59, 59, 999);
    
    console.log(`Date range: ${today.toLocaleDateString()} to ${endDateLimit.toLocaleDateString()}`);

    processedData = processedData.filter(event => {
      const eventStartTime = event.startTime;
      return eventStartTime >= today && eventStartTime <= endDateLimit;
    });
    console.log(`After date filter (${numberOfDaysToShow} days): ${processedData.length} events`);

    // DEBUG: Check for DU events after date filter
    const duEventsAfterDate = processedData.filter(e => e.rinkId === 'du-ritchie');
    console.log(`DU events after date filter: ${duEventsAfterDate.length}`);
    if (duEventsAfterDate.length > 0) {
      console.log("Sample DU event after date filter:", duEventsAfterDate[0]);
    }

    // 2. Rink Filter (only for 'All Rinks' view, based on individual rinks)
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
    
    // 3. Prepare for display (add rinkName) and filter by selected tab (individual or group)
    let rawEventsWithDates: Array<RawIceEventData & { rinkName?: string }> = [];
    
    const selectedTabConfig = rinksConfigForTabs.find(r => r.id === rinkTabId);
    console.log("Selected tab config:", selectedTabConfig);

    if (rinkTabId === ALL_RINKS_TAB_ID) {
      rawEventsWithDates = processedData.map(e => ({
        ...e,
        rinkName: individualRinksForFiltering.find(r => r.id === e.rinkId)?.name || e.rinkId
      }));
    } else if (selectedTabConfig?.memberRinkIds) { // It's a group tab
        rawEventsWithDates = processedData
        .filter(e => selectedTabConfig.memberRinkIds!.includes(e.rinkId))
        .map(e => ({
          ...e,
          // For group tabs, rinkName on event card can still be the specific rink
          rinkName: individualRinksForFiltering.find(r => r.id === e.rinkId)?.name || e.rinkId 
        }));
    } else { // It's a specific, non-grouped rink tab
      console.log(`Filtering for specific rink tab: ${rinkTabId}`);
      console.log(`Looking for events with rinkId === "${rinkTabId}"`);
      
      const matchingEvents = processedData.filter(e => e.rinkId === rinkTabId);
      console.log(`Found ${matchingEvents.length} matching events for rinkId "${rinkTabId}"`);
      
      if (matchingEvents.length > 0) {
        console.log("Sample matching event:", matchingEvents[0]);
      }
      
      // DEBUG: Show all unique rinkIds in the data
      const uniqueRinkIds = [...new Set(processedData.map(e => e.rinkId))];
      console.log("Available rinkIds in filtered data:", uniqueRinkIds);
      
      rawEventsWithDates = matchingEvents.map(e => ({
        ...e,
        rinkName: selectedTabConfig?.name // Name of the tab itself
      }));
    }
     console.log(`After preparing for display (rinkName, tab selection): ${rawEventsWithDates.length} events`);
    
    // 4. Category Filter
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
  }, [rinksConfigForTabs, individualRinksForFiltering, numberOfDaysToShow]);

  // Initial data fetch
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
  
  const handleRefreshData = () => {
    fetchStaticData(true);
  };

  const selectedRinkTabInfo = selectedRinkId !== ALL_RINKS_TAB_ID ? rinksConfigForTabs.find(rink => rink.id === selectedRinkId) : null;

  const getLastUpdateInfo = () => {
    if (!metadata) return 'Unknown';
    
    if (selectedRinkId === ALL_RINKS_TAB_ID) {
      return new Date(metadata.lastCombinedUpdate).toLocaleString();
    } else {
      // Find the most recent update for rinks in this tab
      let latestUpdate = '';
      
      if (selectedRinkTabInfo?.memberRinkIds) {
        // Group tab - find latest update among member rinks
        selectedRinkTabInfo.memberRinkIds.forEach(rinkId => {
          const rinkMeta = metadata.rinks[rinkId];
          if (rinkMeta?.lastSuccessfulScrape) {
            if (!latestUpdate || rinkMeta.lastSuccessfulScrape > latestUpdate) {
              latestUpdate = rinkMeta.lastSuccessfulScrape;
            }
          }
        });
      } else {
        // Individual rink tab
        const rinkMeta = metadata.rinks[selectedRinkId];
        if (rinkMeta?.lastSuccessfulScrape) {
          latestUpdate = rinkMeta.lastSuccessfulScrape;
        }
      }
      
      return latestUpdate ? new Date(latestUpdate).toLocaleString() : 'Unknown';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-700 text-gray-100 p-4 sm:p-6 md:p-8">
      <header className="mb-6 text-center">
        <div className="flex items-center justify-center mb-2">
          <CalendarIcon className="w-10 h-10 mr-3 text-sky-400" />
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-cyan-300">
            Denver Rink Schedule
          </h1>
        </div>
        <p className="text-sm text-slate-400 italic max-w-2xl mx-auto">
          Showing events for the next {numberOfDaysToShow} days. 
          Data is automatically updated twice daily via GitHub Actions.
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
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center justify-center w-full sm:w-auto px-4 py-2 text-sm font-medium text-slate-200 bg-slate-700 hover:bg-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-75 transition-colors"
                aria-expanded={showFilters}
                aria-controls="filter-panel"
              >
                <AdjustmentsHorizontalIcon className="w-5 h-5 mr-2" />
                {showFilters ? 'Hide Filters' : 'Show Filters'}
                {((filterSettings.activeCategories.length > 0) || (filterSettings.activeRinkIds && filterSettings.activeRinkIds.length > 0)) && !showFilters && (
                  <span className="ml-2 bg-sky-500 text-sky-100 text-xs font-bold px-2 py-0.5 rounded-full">
                    Active
                  </span>
                )}
              </button>
              
              <div className="flex items-center px-4 py-2 text-sm bg-green-600/20 text-green-300 rounded-md">
                <div className="w-2 h-2 rounded-full mr-2 bg-green-300" />
                Static Data
                {metadata && (
                  <span className="ml-2 text-xs opacity-75">
                    (Updated: {getLastUpdateInfo()})
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={handleRefreshData}
              disabled={isLoading} 
              className="flex items-center justify-center w-full sm:w-auto px-4 py-2 text-sm font-medium text-sky-200 bg-sky-600 hover:bg-sky-500 disabled:bg-sky-800 disabled:text-sky-400 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-75 transition-colors"
              title="Refresh static data from server"
            >
              <RefreshIcon className={`w-5 h-5 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Loading...' : 'Refresh Data'}
            </button>
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
               {metadata && (
                 <p className="text-xs text-green-400 mt-1">
                   📊 {staticData.length} total events loaded (Last update: {new Date(metadata.lastCombinedUpdate).toLocaleString()})
                 </p>
               )}
             </div>
           )}

          {isLoading && (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <LoadingIcon className="w-12 h-12 mb-4" />
              <p className="text-lg">Loading schedule data...</p>
            </div>
          )}

          {!isLoading && error && (
            <div className="flex flex-col items-center justify-center h-64 text-red-400 bg-red-900/20 p-6 rounded-md">
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mb-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
              <p className="text-lg font-semibold">Error Loading Data</p>
              <p className="text-sm text-center">{error}</p>
              <button 
                onClick={() => handleRefreshData()}
                className="mt-3 px-3 py-1 text-xs bg-sky-600 hover:bg-sky-500 rounded"
              >
                Retry Loading Data
              </button>
            </div>
          )}
          
          {!isLoading && !error && events.length === 0 && (
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

          {!isLoading && !error && events.length > 0 && (
            <EventList events={events} />
          )}
        </div>
      </div>
      <footer className="text-center mt-8 text-sm text-slate-500">
        <p>&copy; {new Date().getFullYear()} Denver Rink Schedule. Data updated automatically via GitHub Actions.</p>
        <p className="mt-1">
          Last data update: {metadata ? new Date(metadata.lastCombinedUpdate).toLocaleString() : 'Loading...'}
        </p>
      </footer>
    </div>
  );
};

export default App;
